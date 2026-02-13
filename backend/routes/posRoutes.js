const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { verifyToken, optionalAuth } = require('../middleware/auth');

// Quick cash amounts (public)
router.get('/quick-cash', posController.getQuickCashAmounts);

// Beepers status
router.get('/beepers', verifyToken, posController.getBeepers);

// Beeper configuration (for settings page)
router.get('/beepers/config', verifyToken, posController.getBeeperConfig);
router.put('/beepers/config', verifyToken, posController.updateBeeperCount);

// Release beeper manually
router.put('/beepers/:beeperNumber/release', verifyToken, posController.releaseBeeperManually);

// Orders
router.get('/orders', verifyToken, posController.getOrders);
router.get('/orders/pending', verifyToken, posController.getPendingOrders);
router.get('/orders/preparing', verifyToken, posController.getPreparingOrders);
router.get('/orders/ready', verifyToken, posController.getReadyOrders);

// Start preparing order
router.put('/order/:id/preparing', verifyToken, posController.startPreparing);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// Get voided transactions
router.get('/transactions/voided', verifyToken, posController.getVoidedTransactions);

// Get completed transactions
router.get('/transactions/completed', verifyToken, posController.getCompletedTransactions);

// Get single transaction (MUST be after specific routes like /voided, /completed)
router.get('/transactions/:id', verifyToken, posController.getTransactionById);

// Create transaction (from POS - requires auth)
router.post('/transactions', verifyToken, posController.createTransaction);

// Create order from Kiosk (no auth required)
router.post('/kiosk/order', posController.createKioskOrder);

// Process payment for pending order
router.put('/transactions/:id/pay', verifyToken, posController.processPayment);

// Mark order as ready
router.put('/orders/:id/ready', verifyToken, posController.markReady);

// Complete order
router.put('/orders/:id/complete', verifyToken, posController.completeOrder);

// Alternative routes for frontend compatibility (transactions/:id/:status pattern)
router.put('/transactions/:id/ready', verifyToken, posController.markReady);
router.put('/transactions/:id/complete', verifyToken, posController.completeOrder);
router.put('/transactions/:id/preparing', verifyToken, posController.startPreparing);

// Void transaction
router.post('/transactions/:id/void', verifyToken, posController.voidTransaction);

module.exports = router;
