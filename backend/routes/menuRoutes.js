const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, isAdmin } = require('../middleware/auth');


// CATEGORIES

router.get('/categories', menuController.getCategories);
router.post('/categories', verifyToken, isAdmin, menuController.createCategory);
router.put('/categories/:id', verifyToken, isAdmin, menuController.updateCategory);
router.delete('/categories/:id', verifyToken, isAdmin, menuController.deleteCategory);


// ITEMS

router.get('/items', menuController.getItems);
router.post('/items', verifyToken, isAdmin, menuController.createItem);
router.put('/items/:id', verifyToken, isAdmin, menuController.updateItem);
router.delete('/items/:id', verifyToken, isAdmin, menuController.deleteItem);

module.exports = router;