const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { verifyToken, isAdmin, requireActiveShiftForNonAdmin } = require('../middleware/auth');

// Quick cash amounts (public)
router.get('/quick-cash', posController.getQuickCashAmounts);

// Current VAT settings (for POS inclusive-price notice)
router.get('/tax-display', verifyToken, posController.getTaxDisplay);

// Takeout cups stock
router.get('/cups/status', posController.getTakeoutCupsStatus);
router.put('/cups/stock', verifyToken, isAdmin, posController.updateTakeoutCupsStock);

// Beepers status
router.get('/beepers', verifyToken, posController.getBeepers);

// Beeper configuration (for settings page)
router.get('/beepers/config', verifyToken, posController.getBeeperConfig);
router.put('/beepers/config', verifyToken, posController.updateBeeperCount);

// Release beeper manually
router.put('/beepers/:beeperNumber/release', verifyToken, posController.releaseBeeperManually);

// Reset all stuck beepers (admin cleanup)
router.post('/beepers/reset', verifyToken, posController.resetAllBeepers);

// Orders
router.get('/orders', verifyToken, posController.getOrders);
router.get('/orders/pending', verifyToken, posController.getPendingOrders);
router.get('/orders/preparing', verifyToken, posController.getPreparingOrders);
router.get('/orders/ready', verifyToken, posController.getReadyOrders);

// Start preparing order
router.put('/order/:id/preparing', verifyToken, requireActiveShiftForNonAdmin, posController.startPreparing);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// Get voided transactions
router.get('/transactions/voided', verifyToken, posController.getVoidedTransactions);

// Get refunded transactions
router.get('/transactions/refunded', verifyToken, posController.getRefundedTransactions);

// Get completed transactions
router.get('/transactions/completed', verifyToken, posController.getCompletedTransactions);

// Get single transaction (MUST be after specific routes like /voided, /completed)
router.get('/transactions/:id', verifyToken, posController.getTransactionById);

// Create transaction (from POS - requires auth)
router.post('/transactions', verifyToken, requireActiveShiftForNonAdmin, posController.createTransaction);

// Create order from Kiosk (no auth required)
router.post('/kiosk/order', posController.createKioskOrder);

// Process payment for pending order
router.put('/transactions/:id/pay', verifyToken, requireActiveShiftForNonAdmin, posController.processPayment);

// Mark order as ready
router.put('/orders/:id/ready', verifyToken, requireActiveShiftForNonAdmin, posController.markReady);

// Complete order
router.put('/orders/:id/complete', verifyToken, requireActiveShiftForNonAdmin, posController.completeOrder);

// Alternative routes for frontend compatibility (transactions/:id/:status pattern)
router.put('/transactions/:id/ready', verifyToken, requireActiveShiftForNonAdmin, posController.markReady);
router.put('/transactions/:id/complete', verifyToken, requireActiveShiftForNonAdmin, posController.completeOrder);
router.put('/transactions/:id/preparing', verifyToken, requireActiveShiftForNonAdmin, posController.startPreparing);

// Void transaction
router.post('/transactions/:id/void', verifyToken, requireActiveShiftForNonAdmin, posController.voidTransaction);

// Refund transaction
router.post('/transactions/:id/refund', verifyToken, requireActiveShiftForNonAdmin, posController.refundTransaction);

// Remove items from pending transaction (partial void)
router.put('/transactions/:id/remove-items', verifyToken, requireActiveShiftForNonAdmin, posController.removeItemsFromPending);

module.exports = router;
