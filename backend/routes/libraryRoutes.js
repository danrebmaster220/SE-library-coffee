const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const { verifyToken, isAdminOrCashier, isAdmin, requireActiveShiftForNonAdmin } = require('../middleware/auth');


// PUBLIC ROUTES (For Kiosk - No Auth Required)

// Get available seats for kiosk display
router.get('/seats/available', libraryController.getAvailableSeatsPublic);


// CONFIGURATION ROUTES (Admin only)

// Get library configuration (tables & seats)
router.get('/config', verifyToken, isAdmin, libraryController.getConfig);

// Configure entire library (set tables and seats per table)
router.post('/config', verifyToken, isAdmin, libraryController.configure);

// Add a new table
router.post('/tables', verifyToken, isAdmin, libraryController.addTable);

// Remove a table
router.delete('/tables/:table_number', verifyToken, isAdmin, libraryController.removeTable);

// Update seats for a table
router.put('/tables/:table_number/seats', verifyToken, isAdmin, libraryController.updateTableSeats);

// Update table name
router.put('/tables/:table_number/name', verifyToken, isAdmin, libraryController.updateTableName);

// Set seat maintenance status
router.put('/seats/:seat_id/maintenance', verifyToken, isAdmin, libraryController.setMaintenance);


// OPERATION ROUTES (Admin & Cashier)

// Get all seats with current status
router.get('/seats', verifyToken, isAdminOrCashier, libraryController.getSeats);

// Get session history (completed and voided)
router.get('/history', verifyToken, isAdminOrCashier, libraryController.getSessionHistory);

// Check-in (start session)
router.post('/checkin', verifyToken, isAdminOrCashier, requireActiveShiftForNonAdmin, libraryController.checkin);

// Extend session
router.post('/extend', verifyToken, isAdminOrCashier, requireActiveShiftForNonAdmin, libraryController.extend);

// Checkout (end session)
router.post('/checkout', verifyToken, isAdminOrCashier, requireActiveShiftForNonAdmin, libraryController.checkout);

// Void a session (Admin & Cashier can both void)
router.post('/void', verifyToken, isAdminOrCashier, requireActiveShiftForNonAdmin, libraryController.voidSession);

// Get session details
router.get('/sessions/:id', verifyToken, isAdminOrCashier, libraryController.getSession);

module.exports = router;
