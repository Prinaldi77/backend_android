const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// Get all notifications
router.get('/', authMiddleware, notificationController.getMyNotifications);

// Get latest notifications (limit 5)
router.get('/latest', authMiddleware, notificationController.getLatestNotifications);

// Mark all as read
router.put('/read-all', authMiddleware, notificationController.markAllAsRead);

// Mark single as read
router.put('/:id/read', authMiddleware, notificationController.markAsRead);

// Send notification (Pembina only)
router.post('/send', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), notificationController.sendNotification);

// Broadcast notification to all students (Pembina only)
router.post('/broadcast', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), notificationController.broadcastNotification);

module.exports = router;
