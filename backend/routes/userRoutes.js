const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Current user profile routes (must be before /:id routes)
router.get('/me/profile', verifyToken, userController.getMyProfile);
router.put('/me/profile', verifyToken, userController.updateMyProfile);
router.put('/me/password', verifyToken, userController.changeMyPassword);
router.put('/me/pin', verifyToken, userController.changeMyPin);

// Get all roles (for dropdown) - must be before /:id
router.get('/meta/roles', verifyToken, isAdmin, userController.getRoles);

// Get all users (with optional search)
router.get('/', verifyToken, isAdmin, userController.getUsers);

// Get user by ID
router.get('/:id', verifyToken, isAdmin, userController.getUserById);

// Create user
router.post('/', verifyToken, isAdmin, userController.createUser);

// Update user
router.put('/:id', verifyToken, isAdmin, userController.updateUser);

// Delete user
router.delete('/:id', verifyToken, isAdmin, userController.deleteUser);

// Reset password
router.post('/:id/reset-password', verifyToken, isAdmin, userController.resetPassword);

module.exports = router;
