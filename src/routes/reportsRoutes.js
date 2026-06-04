const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

router.get('/attendance/summary', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), reportsController.getAttendanceSummary);
router.get('/attendance/activities', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), reportsController.getReportActivities);
router.get('/attendance/top-scouts', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), reportsController.getTopScouts);
router.get('/attendance/export', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), reportsController.exportAttendance);

module.exports = router;
