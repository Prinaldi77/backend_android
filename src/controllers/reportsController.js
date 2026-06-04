const supabase = require('../config/supabaseClient');

const reportsController = {
  // GET /api/reports/attendance/summary
  getAttendanceSummary: async (req, res) => {
    try {
      const { data: attendance } = await supabase.from('attendance').select('status');
      const { count: totalActivities } = await supabase.from('kegiatan').select('*', { count: 'exact', head: true });
      const { count: totalSiswa } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'SISWA');

      let distribution = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      if (attendance) {
        attendance.forEach(a => {
          if (a.status === 'HADIR') distribution.hadir++;
          else if (a.status === 'IZIN') distribution.izin++;
          else if (a.status === 'SAKIT') distribution.sakit++;
          else distribution.alpa++;
        });
      }

      // Hitung overall rate
      const totalPossible = (totalSiswa || 0) * (totalActivities || 0);
      const overallRate = totalPossible > 0 ? Math.round((distribution.hadir / totalPossible) * 100) : 0;

      // Mock weekly trends
      const weeklyTrend = [
        { week: 'W1', attendance: distribution.hadir > 5 ? distribution.hadir - 3 : distribution.hadir, total: totalSiswa || 10 },
        { week: 'W2', attendance: distribution.hadir > 2 ? distribution.hadir - 1 : distribution.hadir, total: totalSiswa || 10 },
        { week: 'W3', attendance: distribution.hadir, total: totalSiswa || 10 },
        { week: 'W4', attendance: distribution.hadir, total: totalSiswa || 10 }
      ];

      return res.status(200).json({
        success: true,
        message: 'Summary report generated',
        data: {
          overallRate,
          distribution,
          weeklyTrend
        }
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/reports/attendance/activities
  getReportActivities: async (req, res) => {
    try {
      const { data: kegiatan } = await supabase.from('kegiatan').select('*');
      const { count: totalSiswa } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'SISWA');
      
      const activitiesReport = [];
      if (kegiatan) {
        for (const k of kegiatan) {
          const { count } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('kegiatan_id', k.id)
            .eq('status', 'HADIR');

          const rate = totalSiswa > 0 ? Math.round((count / totalSiswa) * 100) : 0;
          const start = new Date(k.start_time);

          activitiesReport.push({
            id: k.id.toString(),
            title: k.title,
            location: k.description || 'Lokasi Kegiatan',
            date: start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
            rate,
            iconUrl: null
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Activities report list retrieved',
        data: activitiesReport
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/reports/attendance/top-scouts
  getTopScouts: async (req, res) => {
    try {
      const { data: users } = await supabase.from('profiles').select('id, name').eq('role', 'SISWA');
      const { count: totalKegiatan } = await supabase.from('kegiatan').select('*', { count: 'exact', head: true });

      const topScouts = [];
      if (users) {
        for (const u of users) {
          const { count } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .eq('status', 'HADIR');

          const rate = totalKegiatan > 0 ? Math.round((count / totalKegiatan) * 100) : 0;
          const initial = u.name ? u.name.charAt(0).toUpperCase() : 'P';
          
          const colors = ['#3E5F44', '#5E936C', '#FFD54F', '#4CAF50', '#FFB300', '#E53935'];
          const color = colors[initial.charCodeAt(0) % colors.length];

          topScouts.push({
            name: u.name,
            rate,
            initial,
            color
          });
        }
      }

      // Sort descending by rate
      topScouts.sort((a, b) => b.rate - a.rate);

      return res.status(200).json({
        success: true,
        message: 'Top scouts list retrieved',
        data: topScouts.slice(0, 10) // Limit to top 10
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/reports/attendance/export
  exportAttendance: async (req, res) => {
    try {
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select(`
          id,
          status,
          check_in,
          distance,
          selfie,
          is_mock_location,
          device_id,
          profiles (name, email),
          kegiatan (title)
        `)
        .order('check_in', { ascending: false });

      if (attError) throw attError;

      // BOM UTF-8 for Excel compatibility
      let csv = "\uFEFF";
      csv += "No,Nama Anggota,Email,Nama Kegiatan,Status Kehadiran,Jarak (m),Waktu Presensi,Selfie,Mock GPS,Device ID\n";

      attendance.forEach((row, i) => {
        const no = i + 1;
        const name = row.profiles ? row.profiles.name : '-';
        const email = row.profiles ? row.profiles.email : '-';
        const title = row.kegiatan ? row.kegiatan.title : '-';
        const status = row.status || 'HADIR';
        const distance = row.distance ? Math.round(row.distance) : '-';
        const time = row.check_in ? new Date(row.check_in).toLocaleString('id-ID') : '-';
        const selfie = row.selfie ? row.selfie : '-';
        const mock = row.is_mock_location ? 'YA' : 'TIDAK';
        const device = row.device_id || '-';

        const safeName = `"${name.replace(/"/g, '""')}"`;
        const safeTitle = `"${title.replace(/"/g, '""')}"`;
        const safeSelfie = `"${selfie.replace(/"/g, '""')}"`;

        csv += `${no},${safeName},${email},${safeTitle},${status},${distance},${time},${safeSelfie},${mock},${device}\n`;
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Kehadiran_Scoutify.csv');
      return res.status(200).send(csv);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Gagal mengekspor data: ' + err.message, data: null });
    }
  }
};

module.exports = reportsController;
