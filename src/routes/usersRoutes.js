const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

router.get('/', authMiddleware, usersController.getAllUsers);
router.get('/:id', authMiddleware, usersController.getUserById);

router.post('/', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), usersController.createUser);
router.put('/:id', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), usersController.updateUser);
router.put('/:id/role', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), usersController.updateUserRole);
router.put('/:id/reset-password', authMiddleware, requireRole(['PEMBINA', 'ADMIN']), usersController.resetPassword);

module.exports = router;
