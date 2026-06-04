const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, dashboardController.getDashboard);
router.get('/summary', authMiddleware, dashboardController.getDashboardSummary);

module.exports = router;
