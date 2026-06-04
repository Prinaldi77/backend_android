const supabase = require('../config/supabaseClient');
const { logAudit } = require('../utils/auditLogger');

function formatNotification(n) {
  if (!n) return null;
  const date = new Date(n.created_at);
  const formattedTime = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return {
    id: Number(n.id),
    title: n.title,
    message: n.message,
    content: n.message, // For NotificationItem
    is_read: n.is_read,
    category: n.category || 'Umum',
    time: formattedTime,
    created_at: n.created_at
  };
}

const notificationController = {
  // GET /api/notifications
  getMyNotifications: async (req, res) => {
    try {
      const userId = req.user.sub;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      const formatted = data.map(n => formatNotification(n));

      return res.status(200).json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: formatted
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // GET /api/notifications/latest
  getLatestNotifications: async (req, res) => {
    try {
      const userId = req.user.sub;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      const formatted = data.map(n => formatNotification(n));

      return res.status(200).json({
        success: true,
        message: 'Latest notifications retrieved successfully',
        data: formatted
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/notifications/:id/read
  markAsRead: async (req, res) => {
    try {
      const userId = req.user.sub;
      const { id } = req.params;

      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date() })
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      if (!data || data.length === 0) {
        return res.status(404).json({ success: false, message: 'Notification not found', data: null });
      }

      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: formatNotification(data[0])
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // PUT /api/notifications/read-all
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.sub;

      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date() })
        .eq('user_id', userId)
        .select();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      return res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        data: null
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/notifications/send (Pembina only)
  sendNotification: async (req, res) => {
    try {
      const { targetUserId, title, message, category } = req.body;
      const adminId = req.user.sub;

      if (!targetUserId || !title || !message) {
        return res.status(400).json({ success: false, message: 'targetUserId, title, and message are required', data: null });
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          user_id: targetUserId,
          title,
          message,
          category: category || 'Umum'
        }])
        .select();

      if (error) {
        return res.status(500).json({ success: false, message: error.message, data: null });
      }

      await logAudit(adminId, 'Send Notification', req.ip, `Sent notification to user: ${targetUserId}`);

      return res.status(201).json({
        success: true,
        message: 'Notification sent successfully',
        data: formatNotification(data[0])
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  },

  // POST /api/notifications/broadcast (Pembina/Admin only)
  broadcastNotification: async (req, res) => {
    try {
      const { title, message, category } = req.body;
      const adminId = req.user.sub;

      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'title and message are required', data: null });
      }

      const { data: users, error: fetchErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'SISWA')
        .eq('is_active', true);

      if (fetchErr) {
        return res.status(500).json({ success: false, message: fetchErr.message, data: null });
      }

      if (!users || users.length === 0) {
        return res.status(200).json({ success: true, message: 'Tidak ada siswa aktif untuk dikirimi notifikasi', data: [] });
      }

      const notificationsPayload = users.map(u => ({
        user_id: u.id,
        title,
        message,
        category: category || 'Umum'
      }));

      const { data, error: insertErr } = await supabase
        .from('notifications')
        .insert(notificationsPayload)
        .select();

      if (insertErr) {
        return res.status(500).json({ success: false, message: insertErr.message, data: null });
      }

      await logAudit(adminId, 'Broadcast Notification', req.ip, `Broadcasted notification: ${title} to all active students`);

      return res.status(201).json({
        success: true,
        message: `Berhasil mengirim notifikasi ke ${users.length} siswa`,
        data: data.map(n => formatNotification(n))
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Internal server error', data: null });
    }
  }
};

module.exports = notificationController;
