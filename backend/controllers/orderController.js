const db = require('../config/db');


// CREATE ORDER (from Kiosk)

exports.createOrder = async (req, res) => {
    const { items, total_amount } = req.body; 

    try {
        // Find first available beeper (1-20)
        const [activeOrders] = await db.query(
            `SELECT beeper_number FROM orders WHERE status IN ('pending', 'preparing', 'ready')`
        );
        
        const busyBeepers = activeOrders.map(order => order.beeper_number);
        
        let assignedBeeper = null;
        for (let i = 1; i <= 20; i++) {
            if (!busyBeepers.includes(i)) {
                assignedBeeper = i;
                break;
            }
        }

        if (!assignedBeeper) {
            return res.status(400).json({ error: "All beepers are currently in use. Please wait." });
        }

        // Insert order
        const [orderResult] = await db.query(
            'INSERT INTO orders (beeper_number, total_amount, final_amount, status, payment_status) VALUES (?, ?, ?, ?, ?)',
            [assignedBeeper, total_amount, total_amount, 'pending', 'unpaid']
        );
        
        const newOrderId = orderResult.insertId;

        // Insert order items
        for (const item of items) {
            await db.query(
                'INSERT INTO order_items (order_id, item_id, quantity, price) VALUES (?, ?, ?, ?)',
                [newOrderId, item.item_id, item.quantity, item.price]
            );
        }

        res.json({ 
            message: "Order placed successfully!", 
            order_id: newOrderId, 
            beeper_number: assignedBeeper 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};


// GET ORDER QUEUE (Pending & Preparing)

exports.getOrderQueue = async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, 
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) as item_count
            FROM orders o
            WHERE o.status IN ('pending', 'preparing')
            ORDER BY o.created_at ASC
        `);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET READY ORDERS

exports.getReadyOrders = async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.*, 
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) as item_count
            FROM orders o
            WHERE o.status = 'ready'
            ORDER BY o.created_at ASC
        `);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET COMPLETED ORDERS (with filters)

exports.getCompletedOrders = async (req, res) => {
    const { filter } = req.query; // today, yesterday, week, month

    try {
        let dateFilter = '';
        
        if (filter === 'today') {
            dateFilter = 'AND DATE(o.created_at) = CURDATE()';
        } else if (filter === 'yesterday') {
            dateFilter = 'AND DATE(o.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
        } else if (filter === 'week') {
            dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        } else if (filter === 'month') {
            dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        }

        const [orders] = await db.query(`
            SELECT o.*, 
                   (SELECT COUNT(*) FROM order_items WHERE order_id = o.order_id) as item_count
            FROM orders o
            WHERE o.status = 'completed'
            ${dateFilter}
            ORDER BY o.created_at DESC
        `);
        
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET ORDER DETAILS (with items)

exports.getOrderDetails = async (req, res) => {
    const { id } = req.params;

    try {
        // Get order header
        const [orders] = await db.query(`
            SELECT o.*, d.name as discount_name, d.percentage as discount_percentage
            FROM orders o
            LEFT JOIN discounts d ON o.discount_id = d.discount_id
            WHERE o.order_id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get order items
        const [items] = await db.query(`
            SELECT oi.*, i.name as item_name
            FROM order_items oi
            JOIN items i ON oi.item_id = i.item_id
            WHERE oi.order_id = ?
        `, [id]);

        res.json({
            ...orders[0],
            items
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// PROCESS PAYMENT

exports.processPayment = async (req, res) => {
    const { id } = req.params;
    const { discount_id, cash_tendered, change_due, final_amount } = req.body;

    try {
        await db.query(`
            UPDATE orders 
            SET discount_id = ?, 
                final_amount = ?, 
                cash_tendered = ?, 
                change_due = ?, 
                payment_status = 'paid',
                status = 'preparing'
            WHERE order_id = ?
        `, [discount_id || null, final_amount, cash_tendered, change_due, id]);

        // Get order details for printing
        const [orders] = await db.query(`
            SELECT o.*, d.name as discount_name, d.percentage as discount_percentage
            FROM orders o
            LEFT JOIN discounts d ON o.discount_id = d.discount_id
            WHERE o.order_id = ?
        `, [id]);

        const [items] = await db.query(`
            SELECT oi.*, i.name, i.station
            FROM order_items oi
            JOIN items i ON oi.item_id = i.item_id
            WHERE oi.order_id = ?
        `, [id]);

        const order = { ...orders[0], items };

        // Print receipts (async, don't wait for completion)
        const printerService = require('../services/printerService');
        printerService.printOrderReceipts(order).catch(err => {
            console.error('Print error:', err);
        });

        res.json({ message: 'Payment processed successfully', printStatus: 'queued' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// UPDATE ORDER STATUS

exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'preparing', 'ready', 'completed'

    try {
        await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, id]);
        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// COMPLETE ORDER (Mark as completed)

exports.completeOrder = async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('UPDATE orders SET status = "completed" WHERE order_id = ?', [id]);
        res.json({ message: 'Order completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// REPRINT RECEIPT

exports.reprintReceipt = async (req, res) => {
    const { id } = req.params;

    try {
        // Get order details for reprinting
        const [orders] = await db.query(`
            SELECT o.*, d.name as discount_name, d.percentage as discount_percentage
            FROM orders o
            LEFT JOIN discounts d ON o.discount_id = d.discount_id
            WHERE o.order_id = ?
        `, [id]);

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // Get order items
        const [items] = await db.query(`
            SELECT oi.*, i.name as item_name
            FROM order_items oi
            JOIN items i ON oi.item_id = i.item_id
            WHERE oi.order_id = ?
        `, [id]);

        // Print receipts
        res.json({ 
            message: 'Receipt reprinted successfully',
            order: {
                ...order,
                items
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};