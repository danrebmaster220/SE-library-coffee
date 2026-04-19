const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, isAdmin, isAdminOrCashier } = require('../middleware/auth');


// CATEGORIES

router.get('/categories', menuController.getCategories);
router.get('/tax-display', menuController.getTaxDisplayPublic);
router.get('/tax-estimate', menuController.getTaxEstimatePublic);
router.get('/price-update-settings', verifyToken, isAdmin, menuController.getPriceUpdateSettings);
router.put('/price-update-settings', verifyToken, isAdmin, menuController.updatePriceUpdateSettings);
router.put('/tax-settings', verifyToken, isAdmin, menuController.updateTaxSettings);
router.get('/price-schedules/pending', verifyToken, isAdmin, menuController.getPendingPriceSchedules);
router.put('/price-schedules/:id/cancel', verifyToken, isAdmin, menuController.cancelPendingPriceSchedule);
router.put('/price-schedules/:id/replace', verifyToken, isAdmin, menuController.replacePendingPriceSchedule);
router.get('/price-update-notices', verifyToken, isAdminOrCashier, menuController.getPriceUpdateNotices);
router.post('/categories', verifyToken, isAdmin, menuController.createCategory);
router.put('/categories/:id', verifyToken, isAdmin, menuController.updateCategory);
router.delete('/categories/:id', verifyToken, isAdmin, menuController.deleteCategory);


// ITEMS

router.get('/items', menuController.getItems);
router.post('/items', verifyToken, isAdmin, menuController.createItem);
router.put('/items/:id', verifyToken, isAdmin, menuController.updateItem);
router.delete('/items/:id', verifyToken, isAdmin, menuController.deleteItem);

module.exports = router;