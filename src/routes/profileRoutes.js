const express = require('express');
const router = express.Router();
const { profileController } = require('../controllers/profileController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Get profile
router.get('/me', authMiddleware, profileController.getMyProfile);
router.get('/', authMiddleware, profileController.getMyProfile); // Alias

// Update profile fields
router.put('/me', authMiddleware, profileController.updateMyProfile);
router.put('/update', authMiddleware, profileController.updateMyProfile); // Alias

// Upload profile photo / avatar
router.put('/photo', authMiddleware, upload.single('photo'), profileController.uploadAvatar);
router.post('/avatar', authMiddleware, upload.single('avatar'), profileController.uploadAvatar); // Alias

// Change password
router.put('/change-password', authMiddleware, profileController.changePassword);

module.exports = router;
