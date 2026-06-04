const supabase = require('../config/supabaseClient');

function formatKegiatan(dbKegiatan) {
  if (!dbKegiatan) return null;
  const now = new Date();
  const start = new Date(dbKegiatan.start_time);
  const end = new Date(dbKegiatan.end_time);
  
  let status = "Mendatang";
  let category = "Mendatang";
  if (now >= start && now <= end) {
    status = "Berlangsung";
    category = "Aktif";
  } else if (now > end) {
    status = "Selesai";
    category = "Selesai";
  } else {
    category = "Aktif"; // Mendatang is active
  }

  // Format date
  const dateStr = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;

  return {
    // Database fields
    id: dbKegiatan.id,
    title: dbKegiatan.title,
    description: dbKegiatan.description,
    latitude: Number(dbKegiatan.latitude),
    longitude: Number(dbKegiatan.longitude),
    radius: Number(dbKegiatan.radius),
    start_time: dbKegiatan.start_time,
    end_time: dbKegiatan.end_time,
    type: dbKegiatan.type || 'Umum',
    
    // Android Kegiatan model fields
    nama_kegiatan: dbKegiatan.title,
    tanggal: dateStr,
    waktu_mulai: dbKegiatan.start_time,
    lokasi: dbKegiatan.description || 'Lokasi Kegiatan',
    deskripsi: dbKegiatan.description,
    kategori: category,

    // Android ActivityItem model fields
    date: dateStr,
    location: dbKegiatan.description || 'Lokasi Kegiatan',
    imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=500', 
    status: status,
    category: category, 
    time: timeStr,
    venue: dbKegiatan.description || 'Lokasi Kegiatan',
    isInternal: false,
    subStatus: null,
    participants: []
  };
}

const kegiatanController = {
  // POST /api/kegiatan
  createKegiatan: async (req, res) => {
    try {
      const { title, nama_kegiatan, description, deskripsi, latitude, longitude, radius, startTime, waktu_mulai, endTime, end_time, type, kategori, tanggal } = req.body;

      const finalTitle = title || nama_kegiatan;
      const finalDesc = description || deskripsi;
      let finalStart = startTime || waktu_mulai;
      let finalEnd = endTime || end_time;
      const finalType = type || kategori || 'Umum';

      // Reconstruct ISO timestamp if we get date and start time (standard form values from Android UI)
      if (tanggal && waktu_mulai && waktu_mulai.includes(':')) {
        let formattedDate = tanggal;
        if (!tanggal.includes('-') && tanggal.length === 8) {
          formattedDate = `${tanggal.substring(0, 4)}-${tanggal.substring(4, 6)}-${tanggal.substring(6, 8)}`;
        }
        finalStart = `${formattedDate}T${waktu_mulai}:00.000Z`;
        
        // Calculate end time automatically as start time + 2 hours if not provided
        const [h, m] = waktu_mulai.split(':');
        const startHour = parseInt(h, 10);
        const startMin = parseInt(m, 10);
        const endHour = (startHour + 2) % 24;
        const endHourStr = endHour.toString().padStart(2, '0');
        const endMinStr = startMin.toString().padStart(2, '0');
        finalEnd = `${formattedDate}T${endHourStr}:${endMinStr}:00.000Z`;
      }

      if (!finalTitle || !latitude || !longitude || !finalStart || !finalEnd) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: title, latitude, longitude, start_time, end_time',
          data: null 
        });
      }

      const { data, error } = await supabase
        .from('kegiatan')
        .insert([
          { 
            title: finalTitle, 
            description: finalDesc, 
            latitude, 
            longitude, 
            radius: radius ? Number(radius) : 100, 
            start_time: finalStart, 
            end_time: finalEnd, 
            type: finalType 
          }
        ])
        .select();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(201).json({ 
        success: true, 
        message: 'Kegiatan created successfully', 
        data: formatKegiatan(data[0]) 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/kegiatan ATAU /api/activities
  getAllKegiatan: async (req, res) => {
    try {
      const { category, search } = req.query;

      let query = supabase.from('kegiatan').select('*');

      const { data, error } = await query.order('start_time', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      let formatted = data.map(k => formatKegiatan(k));

      // Filter locally for exact matches (like ActivitiesRepository did)
      if (category && category !== 'Semua') {
        formatted = formatted.filter(k => k.category.toLowerCase() === category.toLowerCase() || k.status.toLowerCase() === category.toLowerCase());
      }
      if (search) {
        formatted = formatted.filter(k => k.title.toLowerCase().includes(search.toLowerCase()));
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Activities retrieved successfully', 
        data: formatted 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/kegiatan/:id
  getKegiatanDetail: async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('kegiatan')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Activity not found', data: null });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Activity detail retrieved successfully', 
        data: formatKegiatan(data) 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/kegiatan/:id
  updateKegiatan: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, nama_kegiatan, description, deskripsi, latitude, longitude, radius, startTime, waktu_mulai, endTime, end_time, type, kategori, tanggal } = req.body;

      const finalTitle = title || nama_kegiatan;
      const finalDesc = description || deskripsi;
      let finalStart = startTime || waktu_mulai;
      let finalEnd = endTime || end_time;
      const finalType = type || kategori;

      if (tanggal && waktu_mulai && waktu_mulai.includes(':')) {
        let formattedDate = tanggal;
        if (!tanggal.includes('-') && tanggal.length === 8) {
          formattedDate = `${tanggal.substring(0, 4)}-${tanggal.substring(4, 6)}-${tanggal.substring(6, 8)}`;
        }
        finalStart = `${formattedDate}T${waktu_mulai}:00.000Z`;
        
        const [h, m] = waktu_mulai.split(':');
        const startHour = parseInt(h, 10);
        const startMin = parseInt(m, 10);
        const endHour = (startHour + 2) % 24;
        const endHourStr = endHour.toString().padStart(2, '0');
        const endMinStr = startMin.toString().padStart(2, '0');
        finalEnd = `${formattedDate}T${endHourStr}:${endMinStr}:00.000Z`;
      }

      const updateData = {
        updated_at: new Date()
      };
      if (finalTitle) updateData.title = finalTitle;
      if (finalDesc) updateData.description = finalDesc;
      if (latitude) updateData.latitude = latitude;
      if (longitude) updateData.longitude = longitude;
      if (radius) updateData.radius = Number(radius);
      if (finalStart) updateData.start_time = finalStart;
      if (finalEnd) updateData.end_time = finalEnd;
      if (finalType) updateData.type = finalType;

      const { data, error } = await supabase
        .from('kegiatan')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error || !data || data.length === 0) {
        return res.status(404).json({ success: false, message: 'Activity not found or update failed', data: null });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Activity updated successfully', 
        data: formatKegiatan(data[0]) 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // DELETE /api/kegiatan/:id
  deleteKegiatan: async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('kegiatan')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Activity deleted successfully', 
        data: null 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/activities/upcoming
  getUpcomingActivities: async (req, res) => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('kegiatan')
        .select('*')
        .gte('start_time', now)
        .order('start_time', { ascending: true })
        .limit(5);

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      const formatted = data.map(k => {
        const item = formatKegiatan(k);
        return {
          id: item.id,
          title: item.title,
          date: item.date,
          location: item.location,
          status: item.status,
          imageUrl: item.imageUrl
        };
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Upcoming activities retrieved', 
        data: formatted 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = kegiatanController;
