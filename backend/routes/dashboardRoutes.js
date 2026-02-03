const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middleware/auth');

// Dashboard statistics
router.get('/stats', verifyToken, dashboardController.getDashboardStats);

// Library status
router.get('/library-status', verifyToken, dashboardController.getLibraryStatus);

// Sales chart data
router.get('/sales-chart', verifyToken, dashboardController.getSalesChart);

// Sales by category
router.get('/category-sales', verifyToken, dashboardController.getCategorySales);

module.exports = router;
