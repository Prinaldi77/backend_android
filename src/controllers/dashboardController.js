const supabase = require('../config/supabaseClient');

const dashboardController = {
  // GET /api/dashboard
  getDashboard: async (req, res) => {
    try {
      // 1. Hitung total anggota aktif
      const { count: totalActiveMembers, error: memberErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('role', 'SISWA');

      if (memberErr) throw memberErr;

      // 2. Hitung total kegiatan
      const { count: totalKegiatan, error: kegiatanErr } = await supabase
        .from('kegiatan')
        .select('*', { count: 'exact', head: true });

      if (kegiatanErr) throw kegiatanErr;

      // 3. Hitung persentase kehadiran
      const { count: totalHadir, error: attendanceErr } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'HADIR');

      if (attendanceErr) throw attendanceErr;

      const possibleAttendance = (totalActiveMembers || 0) * (totalKegiatan || 0);
      const attendancePercentage = possibleAttendance > 0 
        ? Math.round((totalHadir / possibleAttendance) * 100 * 100) / 100
        : 0.0;

      return res.status(200).json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: {
          ringkasan: {
            total_anggota_aktif: totalActiveMembers || 0,
            total_kegiatan: totalKegiatan || 0
          },
          statistik_absensi: {
            persentase_kehadiran: attendancePercentage
          }
        }
      });

    } catch (err) {
      console.error('Error getDashboard:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error: ' + err.message,
        data: null
      });
    }
  },

  // GET /api/dashboard/summary
  getDashboardSummary: async (req, res) => {
    try {
      // Total Siswa
      const { count: totalMembers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'SISWA');

      // Total Pembina
      const { count: totalTrainers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'PEMBINA');

      // Total Kegiatan
      const { count: totalActivities } = await supabase
        .from('kegiatan')
        .select('*', { count: 'exact', head: true });

      // Kehadiran hari ini
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayAttendance } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .gte('check_in', today.toISOString());

      return res.status(200).json({
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: {
          totalMembers: totalMembers || 0,
          totalActivities: totalActivities || 0,
          todayAttendance: todayAttendance || 0,
          totalTrainers: totalTrainers || 0
        }
      });
    } catch (err) {
      console.error('Error getDashboardSummary:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error: ' + err.message,
        data: null
      });
    }
  }
};

module.exports = dashboardController;
