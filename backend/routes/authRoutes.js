const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register (Admin only - add middleware later)
router.post('/register', authController.register);

// GET /api/auth/verify (Check if token is valid)
router.get('/verify', authController.verify);

// POST /api/auth/verify-admin (Verify admin credentials for void operations)
router.post('/verify-admin', verifyToken, authController.verifyAdmin);

// POST /api/auth/verify-admin-pin (Verify admin PIN for sensitive operations)
router.post('/verify-admin-pin', verifyToken, authController.verifyAdminPin);

module.exports = router;
