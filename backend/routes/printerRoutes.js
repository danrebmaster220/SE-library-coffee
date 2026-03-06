const express = require('express');
const router = express.Router();
const printerService = require('../services/printerService');
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get available printers
router.get('/list', verifyToken, isAdmin, async (req, res) => {
    try {
        const printers = await printerService.getAvailablePrinters();
        res.json({ printers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test print
router.post('/test', verifyToken, isAdmin, async (req, res) => {
    try {
        const result = await printerService.testPrint();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Print receipt for a transaction
router.post('/receipt/:transactionId', verifyToken, async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        // Get transaction details with cashier name
        const [transactions] = await db.query(`
            SELECT t.*, d.name as discount_name, d.percentage as discount_percentage,
                   u.full_name as cashier_name
            FROM transactions t
            LEFT JOIN discounts d ON t.discount_id = d.discount_id
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.transaction_id = ?
        `, [transactionId]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const transaction = transactions[0];
        
        // Get transaction items with customizations
        const [items] = await db.query(`
            SELECT ti.*, i.station
            FROM transaction_items ti
            LEFT JOIN items i ON ti.item_id = i.item_id
            WHERE ti.transaction_id = ?
        `, [transactionId]);
        
        // Get customizations for each item
        for (let item of items) {
            const [customizations] = await db.query(`
                SELECT * FROM transaction_item_customizations
                WHERE transaction_item_id = ?
            `, [item.transaction_item_id]);
            item.customizations = customizations;
        }
        
        // Build order object for printer - include transaction_id for receipt
        const order = {
            transaction_id: transaction.transaction_id,
            order_id: transaction.transaction_id,
            beeper_number: transaction.beeper_number,
            order_type: transaction.order_type,
            subtotal: transaction.subtotal,
            total_amount: transaction.subtotal,
            discount_amount: transaction.discount_amount,
            final_amount: transaction.total_amount,
            cash_tendered: transaction.cash_tendered,
            change_due: transaction.change_due,
            cashier_name: transaction.cashier_name,
            library_booking: transaction.library_booking,
            items: items.map(item => ({
                name: item.item_name,
                quantity: item.quantity,
                price: item.unit_price,
                unit_price: item.unit_price,
                station: item.station || 'barista',
                customizations: item.customizations
            }))
        };
        
        // Print receipt
        const result = await printerService.printOrderReceipts(order);
        res.json(result);
    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get receipt data as JSON (for web-based printing)
router.get('/receipt-data/:transactionId', verifyToken, async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        // Get transaction details with cashier name
        const [transactions] = await db.query(`
            SELECT t.*, d.name as discount_name, d.percentage as discount_percentage,
                   u.full_name as cashier_name
            FROM transactions t
            LEFT JOIN discounts d ON t.discount_id = d.discount_id
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.transaction_id = ?
        `, [transactionId]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const transaction = transactions[0];
        
        // Get transaction items with customizations
        const [items] = await db.query(`
            SELECT ti.*, i.station
            FROM transaction_items ti
            LEFT JOIN items i ON ti.item_id = i.item_id
            WHERE ti.transaction_id = ?
        `, [transactionId]);
        
        // Get customizations for each item
        for (let item of items) {
            const [customizations] = await db.query(`
                SELECT * FROM transaction_item_customizations
                WHERE transaction_item_id = ?
            `, [item.transaction_item_id]);
            item.customizations = customizations;
        }
        
        // Parse library booking
        let libraryBooking = null;
        if (transaction.library_booking) {
            try {
                libraryBooking = typeof transaction.library_booking === 'string'
                    ? JSON.parse(transaction.library_booking)
                    : transaction.library_booking;
            } catch (e) {}
        }
        
        // Return structured JSON for web-based receipt rendering
        res.json({
            transaction_id: transaction.transaction_id,
            beeper_number: transaction.beeper_number,
            order_type: transaction.order_type,
            subtotal: parseFloat(transaction.subtotal),
            discount_name: transaction.discount_name,
            discount_percentage: transaction.discount_percentage,
            discount_amount: parseFloat(transaction.discount_amount || 0),
            total_amount: parseFloat(transaction.total_amount),
            cash_tendered: parseFloat(transaction.cash_tendered || 0),
            change_due: parseFloat(transaction.change_due || 0),
            cashier_name: transaction.cashier_name,
            created_at: transaction.created_at,
            library_booking: libraryBooking,
            items: items.map(item => ({
                name: item.item_name,
                quantity: item.quantity,
                unit_price: parseFloat(item.unit_price),
                total_price: parseFloat(item.total_price),
                station: item.station || 'barista',
                customizations: (item.customizations || []).map(c => ({
                    group_name: c.group_name,
                    option_name: c.option_name,
                    quantity: c.quantity || 1,
                    unit_price: parseFloat(c.unit_price || 0),
                    total_price: parseFloat(c.total_price || 0)
                }))
            }))
        });
    } catch (error) {
        console.error('Receipt data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Print customer receipt only (reprint)
router.post('/reprint/:transactionId', verifyToken, async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        // Get transaction details with cashier name
        const [transactions] = await db.query(`
            SELECT t.*, d.name as discount_name,
                   u.full_name as cashier_name
            FROM transactions t
            LEFT JOIN discounts d ON t.discount_id = d.discount_id
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.transaction_id = ?
        `, [transactionId]);
        
        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        const transaction = transactions[0];
        
        // Get transaction items with customizations
        const [items] = await db.query(`
            SELECT ti.*, i.station FROM transaction_items ti
            LEFT JOIN items i ON ti.item_id = i.item_id
            WHERE ti.transaction_id = ?
        `, [transactionId]);
        
        // Get customizations for each item
        for (let item of items) {
            const [customizations] = await db.query(`
                SELECT * FROM transaction_item_customizations
                WHERE transaction_item_id = ?
            `, [item.transaction_item_id]);
            item.customizations = customizations;
        }
        
        // Build order object with transaction_id and customizations
        const order = {
            transaction_id: transaction.transaction_id,
            order_id: transaction.transaction_id,
            beeper_number: transaction.beeper_number,
            order_type: transaction.order_type,
            subtotal: transaction.subtotal,
            total_amount: transaction.subtotal,
            discount_amount: transaction.discount_amount,
            final_amount: transaction.total_amount,
            cash_tendered: transaction.cash_tendered,
            change_due: transaction.change_due,
            cashier_name: transaction.cashier_name,
            library_booking: transaction.library_booking,
            items: items.map(item => ({
                name: item.item_name,
                quantity: item.quantity,
                price: item.unit_price,
                unit_price: item.unit_price,
                station: item.station || 'barista',
                customizations: item.customizations
            }))
        };
        
        // Print customer receipt only
        const receiptData = printerService.buildCustomerReceipt(order);
        await printerService.printRaw(receiptData);
        
        res.json({ success: true, message: 'Receipt reprinted successfully' });
    } catch (error) {
        console.error('Reprint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current printer config
router.get('/config', verifyToken, async (req, res) => {
    res.json({
        printerName: printerService.PRINTER_CONFIG.windowsPrinterName,
        paperWidth: '58mm',
        model: 'JK-5802H'
    });
});

// Update printer name (stored in env/config)
router.put('/config', verifyToken, isAdmin, async (req, res) => {
    const { printerName } = req.body;
    
    // In production, you'd save this to a config file or database
    // For now, we just update the runtime config
    printerService.PRINTER_CONFIG.windowsPrinterName = printerName;
    
    res.json({ 
        message: 'Printer configuration updated',
        printerName 
    });
});

module.exports = router;
