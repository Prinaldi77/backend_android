const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Semua route di bawah ini bersifat PUBLIC (tidak butuh JWT)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
