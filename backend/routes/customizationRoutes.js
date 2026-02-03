const express = require('express');
const router = express.Router();
const customizationController = require('../controllers/customizationController');
const { verifyToken } = require('../middleware/auth');


// CUSTOMIZATION GROUPS

// Get all groups (admin - includes inactive)
router.get('/groups', customizationController.getGroups);

// Get active groups only (for kiosk)
router.get('/groups/active', customizationController.getActiveGroups);

// Create a new group
router.post('/groups', verifyToken, customizationController.createGroup);

// Update a group
router.put('/groups/:id', verifyToken, customizationController.updateGroup);

// Delete a group
router.delete('/groups/:id', verifyToken, customizationController.deleteGroup);


// CUSTOMIZATION OPTIONS

// Get options for a group
router.get('/groups/:groupId/options', customizationController.getOptions);

// Create a new option
router.post('/options', verifyToken, customizationController.createOption);

// Update an option
router.put('/options/:id', verifyToken, customizationController.updateOption);

// Delete an option
router.delete('/options/:id', verifyToken, customizationController.deleteOption);


// ITEM-CUSTOMIZATION LINKING

// Get customizations available for a specific item (for kiosk)
router.get('/item/:itemId', customizationController.getItemCustomizations);

// Get linked groups for an item (admin)
router.get('/item/:itemId/groups', customizationController.getItemGroups);

// Link groups to an item
router.put('/item/:itemId/groups', verifyToken, customizationController.linkItemGroups);

// Get barista item defaults (Size/Temperature) for POS manual ordering
router.get('/barista-defaults/:itemId', customizationController.getBaristaDefaults);

module.exports = router;
