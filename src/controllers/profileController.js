const supabase = require('../config/supabaseClient');
const { logAudit } = require('../utils/auditLogger');

function formatProfile(dbProfile) {
  if (!dbProfile) return null;
  
  // Generate a unique 32-bit positive integer ID from the UUID
  let intId = 0;
  if (dbProfile.id) {
    let hash = 0;
    for (let i = 0; i < dbProfile.id.length; i++) {
      hash = (hash << 5) - hash + dbProfile.id.charCodeAt(i);
      hash |= 0;
    }
    intId = Math.abs(hash);
  }

  return {
    id: intId,
    uuid: dbProfile.id,
    name: dbProfile.name,
    email: dbProfile.email,
    role: dbProfile.role,
    phone: dbProfile.phone,
    rank: dbProfile.rank,
    regu: dbProfile.regu,
    avatar: dbProfile.avatar,
    gugusDepan: dbProfile.gugus_depan,
    nomorInduk: dbProfile.nomor_induk,
    jabatan: dbProfile.jabatan,
    isActive: dbProfile.is_active
  };
}

const profileController = {
  // GET /api/profile/me
  getMyProfile: async (req, res) => {
    try {
      const userId = req.user.sub;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json({ success: false, message: 'Profile not found', data: null });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Profile retrieved successfully', 
        data: formatProfile(data) 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/profile/me
  updateMyProfile: async (req, res) => {
    try {
      const userId = req.user.sub;
      const { name, fullName, phone, phoneNumber, rank, regu, avatar, deviceId, deviceBrand, deviceModel, androidVersion, gugusDepan, nomorInduk, jabatan } = req.body;

      const updateData = {
        updated_at: new Date()
      };
      const finalName = name || fullName;
      const finalPhone = phone || phoneNumber;

      if (finalName) updateData.name = finalName;
      if (finalPhone) updateData.phone = finalPhone;
      if (rank) updateData.rank = rank;
      if (regu) updateData.regu = regu;
      if (avatar) updateData.avatar = avatar;
      if (deviceId) updateData.device_id = deviceId;
      if (deviceBrand) updateData.device_brand = deviceBrand;
      if (deviceModel) updateData.device_model = deviceModel;
      if (androidVersion) updateData.android_version = androidVersion;
      if (gugusDepan) updateData.gugus_depan = gugusDepan;
      if (nomorInduk) updateData.nomor_induk = nomorInduk;
      if (jabatan) updateData.jabatan = jabatan;

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select();

      if (error || !data || data.length === 0) {
        return res.status(500).json({ success: false, message: error ? error.message : 'Update failed', data: null });
      }

      await logAudit(userId, 'Update Profile', req.ip, 'User updated their profile information');

      return res.status(200).json({ 
        success: true, 
        message: 'Profile updated successfully', 
        data: formatProfile(data[0]) 
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/profile/photo OR POST /api/profile/avatar
  uploadAvatar: async (req, res) => {
    try {
      const userId = req.user.sub;
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded', data: null });
      }

      // Build local URL
      const fileUrl = `http://${req.headers.host}/uploads/${req.file.filename}`;

      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar: fileUrl, updated_at: new Date() })
        .eq('id', userId)
        .select();

      if (error || !data || data.length === 0) {
        return res.status(500).json({ success: false, message: error ? error.message : 'Failed to update avatar', data: null });
      }

      await logAudit(userId, 'Upload Avatar', req.ip, `Uploaded avatar: ${req.file.filename}`);

      return res.status(200).json({
        success: true,
        message: 'Profile photo uploaded successfully',
        data: formatProfile(data[0])
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/profile/change-password
  changePassword: async (req, res) => {
    try {
      const userId = req.user.sub;
      const email = req.user.email;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Password lama dan password baru harus diisi', data: null });
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword
      });

      if (signInError) {
        return res.status(400).json({ success: false, message: 'Password lama tidak sesuai', data: null });
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        return res.status(500).json({ success: false, message: updateError.message, data: null });
      }

      await logAudit(userId, 'Change Password', req.ip, 'User changed their password successfully');

      return res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        data: null
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = {
  profileController,
  formatProfile
};
