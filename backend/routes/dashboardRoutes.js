const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Dashboard statistics
router.get('/stats', verifyToken, isAdmin, dashboardController.getDashboardStats);

// Library status
router.get('/library-status', verifyToken, isAdmin, dashboardController.getLibraryStatus);

// Sales chart data
router.get('/sales-chart', verifyToken, isAdmin, dashboardController.getSalesChart);

// Sales by category
router.get('/category-sales', verifyToken, isAdmin, dashboardController.getCategorySales);

module.exports = router;
