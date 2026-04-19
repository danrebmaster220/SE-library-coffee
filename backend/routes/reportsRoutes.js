const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Sales summary (with date range)
router.get('/sales-summary', verifyToken, isAdmin, reportsController.getSalesSummary);

// Sales trend (daily/weekly/monthly)
router.get('/sales-trend', verifyToken, isAdmin, reportsController.getSalesTrend);

// Top products
router.get('/top-products', verifyToken, isAdmin, reportsController.getTopProducts);

// Category performance
router.get('/category-performance', verifyToken, isAdmin, reportsController.getCategoryPerformance);

// Library usage stats
router.get('/library-stats', verifyToken, isAdmin, reportsController.getLibraryStats);

// Hourly sales (peak hours)
router.get('/hourly-sales', verifyToken, isAdmin, reportsController.getHourlySales);

// Orders report (detailed list)
router.get('/orders', verifyToken, isAdmin, reportsController.getOrdersReport);

// Sales details (daily breakdown)
router.get('/sales-details', verifyToken, isAdmin, reportsController.getSalesDetails);

// Library report (session list)
router.get('/library', verifyToken, isAdmin, reportsController.getLibraryReport);

// Audit trail (operational logs)
router.get('/audit-logs', verifyToken, isAdmin, reportsController.getAuditLogs);

// Export by format (default: CSV, supports format=pdf and format=xlsx)
router.get('/export', verifyToken, isAdmin, reportsController.exportReport);

// Export to PDF
router.get('/export-pdf', verifyToken, isAdmin, reportsController.exportPDF);

// VAT remittance bookkeeping (POS sales basis — same filters as sales summary)
router.post('/vat-remittance', verifyToken, isAdmin, reportsController.recordVatRemittance);
router.get('/vat-remittance', verifyToken, isAdmin, reportsController.listVatRemittances);

module.exports = router;
