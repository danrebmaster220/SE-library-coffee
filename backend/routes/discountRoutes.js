const express = require('express');
const router = express.Router();
const discountController = require('../controllers/discountController');
const { verifyToken, isAdmin, isAdminOrCashier } = require('../middleware/auth');

// Get all discounts (Admin view)
router.get('/', verifyToken, isAdmin, discountController.getDiscounts);

// Get active discounts (for POS payment modal)
router.get('/active', verifyToken, isAdminOrCashier, discountController.getActiveDiscounts);

// Create, Update, Delete (Admin only)
router.post('/', verifyToken, isAdmin, discountController.createDiscount);
router.put('/:id', verifyToken, isAdmin, discountController.updateDiscount);
router.delete('/:id', verifyToken, isAdmin, discountController.deleteDiscount);

module.exports = router;
