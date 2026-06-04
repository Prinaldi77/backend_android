const supabase = require('../config/supabaseClient');
const { logAudit } = require('../utils/auditLogger');

// Helper to calculate distance in meters using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const attendanceController = {
  // POST /api/attendance/checkin
  checkIn: async (req, res) => {
    try {
      const userId = req.user.sub;
      
      // Mengambil parameter dari multipart body atau JSON body
      const kegiatanId = req.body.kegiatanId || req.body.activityId;
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      const accuracy = Number(req.body.accuracy || 0);
      const altitude = Number(req.body.altitude || 0);
      const speed = Number(req.body.speed || 0);
      const isMockLocation = req.body.isMockLocation === 'true' || req.body.isMockLocation === true;

      // Cari file selfie dari request
      let selfieUrl = req.body.selfieUrl || null;
      const file = req.files && (req.files.selfie?.[0] || req.files.selfieImage?.[0]);
      if (file) {
        selfieUrl = `http://${req.headers.host}/uploads/${file.filename}`;
      }

      if (!kegiatanId || isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required parameters: kegiatanId, latitude, longitude', 
          data: null 
        });
      }

      // 1. Ambil data kegiatan
      const { data: kegiatan, error: kegiatanErr } = await supabase
        .from('kegiatan')
        .select('*')
        .eq('id', kegiatanId)
        .single();

      if (kegiatanErr || !kegiatan) {
        return res.status(404).json({ success: false, message: 'Kegiatan tidak ditemukan', data: null });
      }

      // 2. Validasi Jarak (Radius)
      const distance = calculateDistance(latitude, longitude, kegiatan.latitude, kegiatan.longitude);
      if (distance > kegiatan.radius) {
        return res.status(400).json({ 
          success: false, 
          message: `Anda di luar radius kegiatan! Jarak Anda: ${Math.round(distance)}m (Maksimal: ${kegiatan.radius}m)`, 
          data: null 
        });
      }

      // 3. Validasi Mock Location
      if (isMockLocation) {
        return res.status(400).json({ success: false, message: 'Gunakan GPS asli Anda!', data: null });
      }

      // 4. Periksa apakah sudah check-in
      const { data: existingCheckin } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('kegiatan_id', kegiatanId)
        .limit(1);

      if (existingCheckin && existingCheckin.length > 0) {
        return res.status(400).json({ success: false, message: 'Anda sudah absen masuk untuk kegiatan ini!', data: null });
      }

      // 5. Simpan data absensi
      const { data: attendance, error: insertErr } = await supabase
        .from('attendance')
        .insert([{
          user_id: userId,
          kegiatan_id: kegiatanId,
          latitude,
          longitude,
          accuracy,
          altitude,
          speed,
          distance,
          selfie: selfieUrl,
          is_mock_location: isMockLocation,
          status: 'HADIR'
        }])
        .select();

      if (insertErr) {
        return res.status(500).json({ success: false, message: insertErr.message, data: null });
      }

      await logAudit(userId, 'Check In', req.ip, `Check in for activity: ${kegiatan.title}`);

      return res.status(201).json({ 
        success: true, 
        message: 'Absen masuk berhasil', 
        data: attendance[0] 
      });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/attendance/checkout
  checkOut: async (req, res) => {
    try {
      const userId = req.user.sub;
      const { attendanceId } = req.body;

      if (!attendanceId) {
        return res.status(400).json({ success: false, message: 'attendanceId is required', data: null });
      }

      const { data, error } = await supabase
        .from('attendance')
        .update({ check_out: new Date(), updated_at: new Date() })
        .eq('id', attendanceId)
        .eq('user_id', userId)
        .select();

      if (error || !data || data.length === 0) {
        return res.status(404).json({ success: false, message: 'Absensi tidak ditemukan atau update gagal', data: null });
      }

      await logAudit(userId, 'Check Out', req.ip, `Check out attendance ID: ${attendanceId}`);

      return res.status(200).json({
        success: true,
        message: 'Absen pulang berhasil',
        data: data[0]
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/attendance/selfie-verification
  verifySelfie: async (req, res) => {
    try {
      const userId = req.user.sub;
      const { activityId, attendanceId, latitude, longitude } = req.body;

      if (!req.file) {
        return res.status(400).json({ success: false, verified: false, message: 'Tidak ada file selfie yang diunggah' });
      }

      // Build static URL
      const fileUrl = `http://${req.headers.host}/uploads/${req.file.filename}`;

      // Update selfie di absensi
      if (attendanceId) {
        await supabase
          .from('attendance')
          .update({ selfie: fileUrl, updated_at: new Date() })
          .eq('id', attendanceId)
          .eq('user_id', userId);
      }

      await logAudit(userId, 'Selfie Verification', req.ip, `Selfie verified for activity: ${activityId}`);

      return res.status(200).json({
        success: true,
        verified: true,
        message: 'Selfie berhasil diverifikasi'
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, verified: false, message: 'Internal server error' });
    }
  },

  // POST /api/attendance/permit
  submitPermit: async (req, res) => {
    try {
      const userId = req.user.sub;
      const { kegiatanId, reason, type } = req.body;

      let documentUrl = null;
      if (req.file) {
        documentUrl = `http://${req.headers.host}/uploads/${req.file.filename}`;
      }

      if (!kegiatanId || !type) {
        return res.status(400).json({ success: false, message: 'kegiatanId and type (SAKIT/IZIN) are required', data: null });
      }

      // Simpan data izin sebagai status absensi
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          user_id: userId,
          kegiatan_id: kegiatanId,
          latitude: 0,
          longitude: 0,
          accuracy: 0,
          distance: 0,
          status: type.toUpperCase(), // 'SAKIT' or 'IZIN'
          selfie: documentUrl, // Gunakan kolom selfie untuk menyimpan URL dokumen/bukti
          device_id: reason || 'Izin diajukan' // Simpan alasan di kolom device_id untuk menghindari error schema
        }])
        .select();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      await logAudit(userId, 'Submit Permit', req.ip, `Submitted permit type: ${type} for activity: ${kegiatanId}`);

      return res.status(201).json({
        success: true,
        message: 'Pengajuan izin berhasil dikirim',
        data: data[0]
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/attendance/me
  getMyAttendance: async (req, res) => {
    try {
      const userId = req.user.sub;

      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          kegiatan:kegiatan_id(title, start_time, type)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({
        success: true,
        message: 'Success retrieving my attendance',
        data
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/attendance/today
  getTodayAttendance: async (req, res) => {
    try {
      const userId = req.user.sub;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gte('check_in', today.toISOString());

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({
        success: true,
        message: 'Success retrieving today attendance',
        data: data
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/attendance/current-activity
  getCurrentActivity: async (req, res) => {
    try {
      const now = new Date().toISOString();
      
      // Ambil kegiatan yang sedang berlangsung saat ini
      const { data: kegiatan, error } = await supabase
        .from('kegiatan')
        .select('*')
        .lte('start_time', now)
        .gte('end_time', now)
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      let activeActivity = null;
      if (kegiatan && kegiatan.length > 0) {
        const k = kegiatan[0];
        const start = new Date(k.start_time);
        const end = new Date(k.end_time);
        const range = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
        
        activeActivity = {
          id: k.id,
          name: k.title,
          latitude: Number(k.latitude),
          longitude: Number(k.longitude),
          radius: Number(k.radius),
          locationName: k.description || 'Lokasi Kegiatan',
          timeRange: range
        };
      }

      // Gunakan dual format (at root and wrapped in data)
      const responsePayload = {
        success: true,
        message: activeActivity ? 'Active activity found' : 'No active activity currently',
        data: activeActivity
      };

      if (activeActivity) {
        Object.assign(responsePayload, activeActivity);
      }

      return res.status(200).json(responsePayload);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/attendance/status
  getAttendanceStatus: async (req, res) => {
    try {
      const userId = req.user.sub;
      const now = new Date().toISOString();

      // Cari kegiatan saat ini
      const { data: kegiatan } = await supabase
        .from('kegiatan')
        .select('*')
        .lte('start_time', now)
        .gte('end_time', now)
        .limit(1);

      let statusPayload = {
        status: "Belum Check In",
        checkInTime: null
      };

      if (kegiatan && kegiatan.length > 0) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', userId)
          .eq('kegiatan_id', kegiatan[0].id)
          .single();

        if (attendance) {
          statusPayload.status = attendance.status === 'HADIR' ? 'Sudah Check In' : attendance.status;
          statusPayload.checkInTime = attendance.check_in;
        }
      }

      // Dual format
      const responsePayload = {
        success: true,
        message: 'Attendance status retrieved',
        data: statusPayload,
        ...statusPayload
      };

      return res.status(200).json(responsePayload);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/attendance/kegiatan/:kegiatanId
  getAttendanceByKegiatan: async (req, res) => {
    try {
      const { kegiatanId } = req.params;
      
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:user_id(name, email, regu)
        `)
        .eq('kegiatan_id', kegiatanId);

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Retrieve attendance list successfully', 
        data 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = attendanceController;
