const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Check-in (supports both JSON body and multipart selfie upload)
router.post('/checkin', authMiddleware, upload.fields([
  { name: 'selfie', maxCount: 1 }, 
  { name: 'selfieImage', maxCount: 1 }
]), attendanceController.checkIn);

// Check-out
router.post('/checkout', authMiddleware, attendanceController.checkOut);

// Selfie verification endpoint
router.post('/selfie-verification', authMiddleware, upload.single('selfieImage'), attendanceController.verifySelfie);

// Submit permit (document proof upload)
router.post('/permit', authMiddleware, upload.single('document'), attendanceController.submitPermit);

// Attendance records
router.get('/me', authMiddleware, attendanceController.getMyAttendance);
router.get('/today', authMiddleware, attendanceController.getTodayAttendance);
router.get('/current-activity', authMiddleware, attendanceController.getCurrentActivity);
router.get('/status', authMiddleware, attendanceController.getAttendanceStatus);

// Admin-only view by activity ID
router.get('/kegiatan/:kegiatanId', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), attendanceController.getAttendanceByKegiatan);

module.exports = router;
