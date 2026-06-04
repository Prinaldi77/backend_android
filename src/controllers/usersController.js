const supabase = require('../config/supabaseClient');
const supabaseAdmin = require('../config/supabaseAdmin');
const { logAudit } = require('../utils/auditLogger');
const { formatProfile } = require('./profileController');

// Helper to find profile by UUID or numeric hash
async function findUserByParamId(paramId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(paramId)) {
    const { data } = await supabase.from('profiles').select('*').eq('id', paramId).single();
    return data;
  }

  const { data } = await supabase.from('profiles').select('*');
  if (!data) return null;

  const targetInt = Number(paramId);
  for (const user of data) {
    let hash = 0;
    for (let i = 0; i < user.id.length; i++) {
      hash = (hash << 5) - hash + user.id.charCodeAt(i);
      hash |= 0;
    }
    if (Math.abs(hash) === targetInt) {
      return user;
    }
  }
  return null;
}

const usersController = {
  // GET /api/users or /api/anggota
  getAllUsers: async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      const formatted = data.map(u => {
        let hash = 0;
        for (let i = 0; i < u.id.length; i++) {
          hash = (hash << 5) - hash + u.id.charCodeAt(i);
          hash |= 0;
        }
        const intId = Math.abs(hash);
        return {
          id: intId,
          uuid: u.id,
          nama: u.name,
          name: u.name,
          email: u.email,
          phone: u.phone || '',
          nisn: u.nomor_induk || '0000000000',
          nomorInduk: u.nomor_induk || '0000000000',
          jabatan: u.jabatan || u.rank || 'ANGGOTA',
          rank: u.rank || 'Penggalang',
          regu: u.regu || 'Garuda',
          foto_url: u.avatar || null,
          fotoUrl: u.avatar || null,
          avatar: u.avatar || null,
          status: u.is_active ? 'Aktif' : 'Non-aktif',
          isActive: u.is_active,
          role: u.role
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Success retrieving users',
        data: formatted
      });
    } catch (err) {
      console.error('Error getAllUsers:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/users/:id or /api/anggota/:id
  getUserById: async (req, res) => {
    try {
      const user = await findUserByParamId(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }

      // 1. Ambil riwayat absen
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select(`
          id, 
          check_in, 
          status, 
          kegiatan_id, 
          kegiatan:kegiatan_id(title, start_time, type)
        `)
        .eq('user_id', user.id);

      // 2. Hitung statistik & format riwayat
      let presentCount = 0;
      let history = [];
      if (attendanceData) {
        presentCount = attendanceData.filter(a => a.status === 'HADIR').length;
        history = attendanceData.map(a => {
          const startDate = a.kegiatan?.start_time ? new Date(a.kegiatan.start_time) : new Date(a.check_in);
          return {
            id: Number(a.id),
            title: a.kegiatan?.title || 'Kegiatan Pramuka',
            date: startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: a.status === 'HADIR' ? 'Present' : (a.status === 'IZIN' ? 'Late' : 'Absent'),
            type: a.kegiatan?.type || 'Umum'
          };
        });
      }

      const { count: totalActivities } = await supabase
        .from('kegiatan')
        .select('*', { count: 'exact', head: true });

      const attendanceRate = totalActivities > 0 ? Math.round((presentCount / totalActivities) * 100) : 0;

      // Format detail anggota
      let hash = 0;
      for (let i = 0; i < user.id.length; i++) {
        hash = (hash << 5) - hash + user.id.charCodeAt(i);
        hash |= 0;
      }
      const intId = Math.abs(hash);

      const memberDetail = {
        id: intId,
        uuid: user.id,
        name: user.name,
        nama: user.name,
        rank: user.rank || 'Penggalang',
        nisn: user.nomor_induk || '0000000000',
        nomorInduk: user.nomor_induk || '0000000000',
        foto_url: user.avatar || null,
        fotoUrl: user.avatar || null,
        avatar: user.avatar || null,
        status: user.is_active ? 'Aktif' : 'Non-aktif',
        isActive: user.is_active,
        birthInfo: 'Bandung, 1 Januari 2010', // Default mock info
        phone: user.phone || '',
        address: 'Bandung, Indonesia',
        bloodType: 'O',
        regu: user.regu || 'Garuda',
        jabatan: user.jabatan || user.rank || 'ANGGOTA',
        role: user.role,
        achievements: [
          { id: 1, title: 'TKK Menabung', date: '10 Mei 2026', icon: 'savings' },
          { id: 2, title: 'TKK Berkemah', date: '25 Mei 2026', icon: 'campground' }
        ],
        activityHistory: history,
        attendanceRate: attendanceRate
      };

      return res.status(200).json({
        success: true,
        message: 'Success retrieving member detail',
        data: memberDetail
      });
    } catch (err) {
      console.error('Error getUserById:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/users or /api/anggota
  createUser: async (req, res) => {
    try {
      const { name, nama, email, password, role, phone, regu, rank, gugusDepan, nomorInduk, nisn, jabatan, status } = req.body;

      const finalName = name || nama;
      const finalEmail = email || (nisn ? `${nisn}@scoutify.com` : `user_${Date.now()}@scoutify.com`);
      const finalPassword = password || 'Password123!';
      const finalRole = role || 'SISWA';

      if (!finalName) {
        return res.status(400).json({ success: false, message: 'Nama lengkap wajib diisi', data: null });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, message: 'Server configuration error: Admin privileges not set', data: null });
      }

      // 1. Create User via Supabase Auth Admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password: finalPassword,
        email_confirm: true
      });

      if (authError) {
        return res.status(400).json({ success: false, message: authError.message, data: null });
      }

      const userId = authData.user.id;

      // 2. Insert into profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          name: finalName,
          email: finalEmail,
          phone: phone || null,
          regu: regu || null,
          rank: rank || 'Penggalang',
          gugus_depan: gugusDepan || null,
          nomor_induk: nomorInduk || nisn || null,
          role: finalRole.toUpperCase(),
          jabatan: jabatan || rank || 'ANGGOTA',
          is_active: status !== 'Non-aktif'
        }])
        .select()
        .single();

      if (profileError) {
        return res.status(500).json({ success: false, message: 'User created but failed to save profile: ' + profileError.message, data: null });
      }

      await logAudit(req.user.sub, 'Create User', req.ip, `Created user ${finalEmail} with role ${finalRole}`);

      return res.status(201).json({
        success: true,
        message: 'User successfully created',
        data: formatProfile(profile)
      });
    } catch (err) {
      console.error('Error createUser:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/users/:id
  updateUser: async (req, res) => {
    try {
      const user = await findUserByParamId(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }

      const { name, nama, phone, regu, rank, gugusDepan, nomorInduk, nisn, role, jabatan, status, isActive } = req.body;

      const updateData = {
        updated_at: new Date()
      };
      if (name || nama) updateData.name = name || nama;
      if (phone) updateData.phone = phone;
      if (regu) updateData.regu = regu;
      if (rank) updateData.rank = rank;
      if (gugusDepan) updateData.gugus_depan = gugusDepan;
      if (nomorInduk || nisn) updateData.nomor_induk = nomorInduk || nisn;
      if (role) updateData.role = role.toUpperCase();
      if (jabatan) updateData.jabatan = jabatan;
      if (rank && !jabatan) updateData.jabatan = rank; // Sync fallback

      if (status !== undefined) {
        updateData.is_active = status === 'Aktif' || status === 'Online' || status === true;
      } else if (isActive !== undefined) {
        updateData.is_active = isActive === true;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      await logAudit(req.user.sub, 'Update User Info', req.ip, `Updated info for user: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: formatProfile(data)
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/users/:id/role
  updateUserRole: async (req, res) => {
    try {
      const user = await findUserByParamId(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }

      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ success: false, message: 'Role is required', data: null });
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ role: role.toUpperCase() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      await logAudit(req.user.sub, 'Update User Role', req.ip, `Updated user ID ${user.id} to role ${role}`);

      return res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: formatProfile(data)
      });
    } catch (err) {
      console.error('Error updateUserRole:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/users/:id/reset-password
  resetPassword: async (req, res) => {
    try {
      const user = await findUserByParamId(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ success: false, message: 'Server configuration error: Admin privileges not set', data: null });
      }

      // Reset ke password default '123456' atau 'Password123!'
      const defaultTempPassword = 'Password123!';
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: defaultTempPassword }
      );

      if (resetErr) {
        return res.status(400).json({ success: false, message: resetErr.message, data: null });
      }

      await logAudit(req.user.sub, 'Reset Password', req.ip, `Reset password for user: ${user.email}`);

      return res.status(200).json({
        success: true,
        message: `Password berhasil direset ke: ${defaultTempPassword}`,
        data: null
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = usersController;
