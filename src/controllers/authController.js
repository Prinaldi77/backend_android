const supabase = require('../config/supabaseClient');
const { logAudit } = require('../utils/auditLogger');

const authController = {
  // POST /api/auth/register
  register: async (req, res) => {
    try {
      const { name, email, password, phone, regu, gugusDepan, nomorInduk } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'name, email, and password are required', data: null });
      }

      // 1. Daftarkan user ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return res.status(400).json({ success: false, message: authError.message, data: null });
      }

      const userId = authData.user?.id;
      if (!userId) {
        return res.status(500).json({ success: false, message: 'Failed to create user account', data: null });
      }

      // 2. Simpan profil lengkap ke tabel public.profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          name,
          email,
          phone: phone || null,
          regu: regu || null,
          gugus_depan: gugusDepan || null,
          nomor_induk: nomorInduk || null,
          role: 'SISWA', // Default role saat daftar
        }])
        .select()
        .single();

      if (profileError) {
        return res.status(500).json({ success: false, message: 'Account created but failed to save profile: ' + profileError.message, data: null });
      }

      return res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email if required.',
        data: {
          id: userId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        }
      });

    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/auth/login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'email and password are required', data: null });
      }

      // 1. Login via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        return res.status(401).json({ success: false, message: 'Invalid email or password', data: null });
      }

      const userId = authData.user.id;
      const accessToken = authData.session.access_token;
      const refreshToken = authData.session.refresh_token;

      // 2. Ambil profil dari tabel public.profiles (untuk mendapatkan role, dll)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ success: false, message: 'User profile not found', data: null });
      }

      // 3. Cek apakah akun aktif
      if (!profile.is_active) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact admin.', data: null });
      }

      // 4. Catat log login
      await logAudit(userId, 'User Login', req.ip, `Login via email: ${email}`);

      // Android reads tokens and user flat fields or nested. Return BOTH for safety.
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken
        },
        accessToken: accessToken,
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          avatar: profile.avatar,
          regu: profile.regu,
          rank: profile.rank,
          gugus_depan: profile.gugus_depan,
        },
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            avatar: profile.avatar,
            regu: profile.regu,
            rank: profile.rank,
            gugus_depan: profile.gugus_depan,
          }
        }
      });

    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/auth/logout
  logout: async (req, res) => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({ success: true, message: 'Logout successful', data: null });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/auth/refresh-token
  refreshToken: async (req, res) => {
    try {
      const { refresh_token, refreshToken: rf } = req.body;
      const finalRefreshToken = refresh_token || rf;

      if (!finalRefreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token is required', data: null });
      }

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: finalRefreshToken });

      if (error) {
        return res.status(400).json({ success: false, message: error.message, data: null });
      }

      const userId = data.user.id;
      const accessToken = data.session.access_token;
      const newRefreshToken = data.session.refresh_token;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const responseData = {
        accessToken: accessToken,
        access_token: accessToken,
        refresh_token: newRefreshToken,
        tokens: {
          accessToken: accessToken,
          refreshToken: newRefreshToken
        },
        user: profile ? {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          avatar: profile.avatar,
          regu: profile.regu,
          rank: profile.rank,
          gugus_depan: profile.gugus_depan
        } : null
      };

      return res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: responseData,
        ...responseData
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = authController;
