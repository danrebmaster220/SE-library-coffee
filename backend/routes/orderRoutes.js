const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, isAdminOrCashier } = require('../middleware/auth');

// Create order (from Kiosk - no auth required)
router.post('/', orderController.createOrder);

// Get order queues (POS screens)
router.get('/queue', verifyToken, isAdminOrCashier, orderController.getOrderQueue);
router.get('/ready', verifyToken, isAdminOrCashier, orderController.getReadyOrders);
router.get('/completed', verifyToken, isAdminOrCashier, orderController.getCompletedOrders);

// Get order details
router.get('/:id', verifyToken, isAdminOrCashier, orderController.getOrderDetails);

// Process payment (Cashier)
router.post('/:id/payment', verifyToken, isAdminOrCashier, orderController.processPayment);

// Update order status (Barista/Kitchen)
router.put('/:id/status', verifyToken, orderController.updateOrderStatus);

// Complete order (mark as done)
router.post('/:id/complete', verifyToken, isAdminOrCashier, orderController.completeOrder);

// Reprint receipt
router.post('/:id/reprint', verifyToken, isAdminOrCashier, orderController.reprintReceipt);

module.exports = router;