const supabase = require('../config/supabaseClient');

const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.sub; // 'sub' adalah standard untuk user ID di JWT

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID not found in token' });
      }

      // Mengambil profil pengguna dari tabel public.profiles (yang terhubung ke auth.users)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      if (!allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to access this resource' });
      }

      // Menambahkan data role ke req untuk digunakan di controller
      req.user.role = profile.role;
      next();
    } catch (error) {
      console.error('Role validation error:', error);
      return res.status(500).json({ error: 'Internal server error during role validation' });
    }
  };
};

module.exports = requireRole;
