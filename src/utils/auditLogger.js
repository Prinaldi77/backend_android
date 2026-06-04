const supabaseClient = require('../config/supabaseClient');
const supabaseAdmin = require('../config/supabaseAdmin');

// Gunakan supabaseAdmin (menggunakan Service Role Key) untuk melewati RLS,
// atau fallback ke supabaseClient biasa jika supabaseAdmin null/tidak terkonfigurasi.
const supabase = supabaseAdmin || supabaseClient;

/**
 * Mencatat aktivitas pengguna ke tabel audit_logs
 * @param {string} userId - UUID pengguna
 * @param {string} action - Deskripsi aksi (misal: 'User login', 'Update profile')
 * @param {string} ipAddress - Alamat IP pengguna (opsional)
 * @param {string} details - Detail tambahan dalam bentuk teks/JSON string (opsional)
 */
const logAudit = async (userId, action, ipAddress = null, details = null) => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        user_id: userId,
        action: action,
        ip_address: ipAddress,
        details: details
      }]);

    if (error) {
      console.error('Failed to write audit log:', error.message);
    }
  } catch (err) {
    console.error('Audit logger error:', err);
  }
};

module.exports = { logAudit };
