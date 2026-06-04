const express = require('express');
const router = express.Router();
const kasController = require('../controllers/kasController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// Get all kas records - Semua pengguna terautentikasi bisa melihat
router.get('/', authMiddleware, kasController.getAllKas);

// Get summary (saldo total)
router.get('/summary', authMiddleware, kasController.getKasSummary);

// Add kas record - Hanya BENDAHARA atau PEMBINA
router.post('/', authMiddleware, requireRole(['BENDAHARA', 'PEMBINA', 'ADMIN']), kasController.addKas);

module.exports = router;
