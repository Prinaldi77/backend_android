const express = require('express');
const router = express.Router();
const kegiatanController = require('../controllers/kegiatanController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// Get all activities (supports query search & category)
router.get('/', authMiddleware, kegiatanController.getAllKegiatan);

// Get upcoming activities
router.get('/upcoming', authMiddleware, kegiatanController.getUpcomingActivities);

// Get detailed activity
router.get('/:id', authMiddleware, kegiatanController.getKegiatanDetail);

// Create new activity
router.post('/', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), kegiatanController.createKegiatan);

// Update activity
router.put('/:id', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), kegiatanController.updateKegiatan);

// Delete activity
router.delete('/:id', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), kegiatanController.deleteKegiatan);

module.exports = router;
