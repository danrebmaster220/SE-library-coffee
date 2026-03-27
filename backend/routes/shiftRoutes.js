const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Cashier routes
router.post('/start', verifyToken, shiftController.startShift);
router.get('/my-active', verifyToken, shiftController.getMyActiveShift);
router.post('/end', verifyToken, shiftController.endShift);

// Admin routes
router.get('/active', verifyToken, isAdmin, shiftController.getAllActiveShifts);
router.get('/history', verifyToken, isAdmin, shiftController.getShiftHistory);
router.post('/:id/force-close', verifyToken, isAdmin, shiftController.forceCloseShift);

module.exports = router;
