const db = require('../config/db');


// BEEPER MANAGEMENT

// Get next available beeper
const getAvailableBeeper = async () => {
    const [beepers] = await db.query(
        'SELECT beeper_number FROM beepers WHERE status = ? ORDER BY beeper_number LIMIT 1',
        ['available']
    );
    return beepers.length > 0 ? beepers[0].beeper_number : null;
};

// Assign beeper to transaction
const assignBeeper = async (beeperNumber, transactionId) => {
    await db.query(
        'UPDATE beepers SET status = ?, transaction_id = ?, assigned_at = NOW() WHERE beeper_number = ?',
        ['in-use', transactionId, beeperNumber]
    );
};

// Release beeper
const releaseBeeper = async (beeperNumber) => {
    await db.query(
        'UPDATE beepers SET status = ?, transaction_id = NULL, assigned_at = NULL WHERE beeper_number = ?',
        ['available', beeperNumber]
    );
};


// QUICK CASH AMOUNTS

exports.getQuickCashAmounts = async (req, res) => {
    try {
        const [amounts] = await db.query(
            'SELECT * FROM quick_cash_amounts WHERE status = ? ORDER BY display_order',
            ['active']
        );
        res.json({ amounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// TRANSACTIONS

// Get all orders (for POS display) - Filtered by user role
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        // Build query with optional user filter
        let query = `
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.status IN ('pending', 'paid', 'preparing', 'ready')
            AND DATE(t.created_at) = CURDATE()
        `;
        
        const params = [];
        
        // If not admin, only show orders processed by this user OR pending orders (from kiosk)
        if (!isAdmin && userId) {
            query += ` AND (t.processed_by = ? OR t.processed_by IS NULL)`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.created_at DESC`;

        const [orders] = await db.query(query, params);

        // Get items for each order
        for (let order of orders) {
            const [items] = await db.query(`
                SELECT ti.*, i.name as item_name_db
                FROM transaction_items ti
                JOIN items i ON ti.item_id = i.item_id
                WHERE ti.transaction_id = ?
            `, [order.transaction_id]);

            // Get customizations for each item
            for (let item of items) {
                const [customizations] = await db.query(`
                    SELECT * FROM transaction_item_customizations
                    WHERE transaction_item_id = ?
                `, [item.transaction_item_id]);
                item.customizations = customizations;
            }

            order.items = items;
        }

        res.json({ orders, isAdmin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create new transaction (from POS or Kiosk)
exports.createTransaction = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const {
            order_type,
            beeper_id, 
            items,
            subtotal,
            discount_id,
            discount_amount,
            total_amount,
            cash_tendered,
            change_due,
            status
        } = req.body;

        // Get beeper number - either from provided beeper_id or get next available
        let beeperNumber;
        if (beeper_id) {
            const [beeper] = await connection.query(
                'SELECT beeper_number FROM beepers WHERE beeper_number = ? AND status = ?',
                [beeper_id, 'available']
            );
            if (beeper.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Selected beeper is not available.' });
            }
            beeperNumber = beeper[0].beeper_number;
        } else {
            beeperNumber = await getAvailableBeeper();
            if (!beeperNumber) {
                await connection.rollback();
                return res.status(400).json({ error: 'No beepers available. Please wait.' });
            }
        }

        // Get user ID from token (if authenticated) or null for kiosk
        const userId = req.user?.user_id || null;

        // Create transaction
        const [result] = await connection.query(`
            INSERT INTO transactions (
                beeper_number, order_type, subtotal, discount_id, discount_amount,
                total_amount, cash_tendered, change_due, status, paid_at, processed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
            beeperNumber,
            order_type || 'dine-in',
            subtotal,
            discount_id || null,
            discount_amount || 0,
            total_amount,
            cash_tendered,
            change_due,
            status || 'preparing',
            userId
        ]);

        const transactionId = result.insertId;

        // Insert transaction items
        for (const item of items) {
            const [itemResult] = await connection.query(`
                INSERT INTO transaction_items (
                    transaction_id, item_id, item_name, quantity, unit_price, total_price, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                transactionId,
                item.item_id,
                item.item_name,
                item.quantity,
                item.unit_price,
                item.total_price,
                item.notes || null
            ]);

            const transactionItemId = itemResult.insertId;

            // Insert customizations if any
            if (item.customizations && item.customizations.length > 0) {
                for (const custom of item.customizations) {
                    await connection.query(`
                        INSERT INTO transaction_item_customizations (
                            transaction_item_id, option_id, option_name, group_name,
                            quantity, unit_price, total_price
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `, [
                        transactionItemId,
                        custom.option_id,
                        custom.option_name,
                        custom.group_name || '',
                        custom.quantity || 1,
                        custom.unit_price || 0,
                        custom.total_price || 0
                    ]);
                }
            }
        }

        // Assign beeper to this transaction
        await connection.query(
            'UPDATE beepers SET status = ?, transaction_id = ?, assigned_at = NOW() WHERE beeper_number = ?',
            ['in-use', transactionId, beeperNumber]
        );

        await connection.commit();

        // Emit real-time beeper update via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('beepers:update', { beeper_number: beeperNumber, status: 'in-use' });
        }

        res.json({
            message: 'Transaction created successfully',
            transaction_id: transactionId,
            beeper_number: beeperNumber
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Create order from Kiosk (pending payment)
exports.createKioskOrder = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const { order_type, items, subtotal, total_amount, library_booking } = req.body;

        // Get available beeper
        const beeperNumber = await getAvailableBeeper();
        if (!beeperNumber) {
            await connection.rollback();
            return res.status(400).json({ error: 'No beepers available. Please wait.' });
        }

        // Create transaction with pending status
        // Include library_booking JSON if present
        const [result] = await connection.query(`
            INSERT INTO transactions (
                beeper_number, order_type, subtotal, total_amount, status, library_booking
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [beeperNumber, order_type || 'dine-in', subtotal, total_amount, 'pending', 
            library_booking ? JSON.stringify(library_booking) : null]);

        const transactionId = result.insertId;

        // Insert transaction items (only if there are items)
        if (items && items.length > 0) {
            for (const item of items) {
                const [itemResult] = await connection.query(`
                    INSERT INTO transaction_items (
                        transaction_id, item_id, item_name, quantity, unit_price, total_price
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [transactionId, item.item_id, item.item_name, item.quantity, item.unit_price, item.total_price]);

                const transactionItemId = itemResult.insertId;

                // Insert customizations
                if (item.customizations?.length > 0) {
                    for (const custom of item.customizations) {
                        await connection.query(`
                            INSERT INTO transaction_item_customizations (
                                transaction_item_id, option_id, option_name, group_name,
                                quantity, unit_price, total_price
                            ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        `, [transactionItemId, custom.option_id, custom.option_name, custom.group_name || '',
                            custom.quantity || 1, custom.unit_price || 0, custom.total_price || 0]);
                    }
                }
            }
        }

        // Assign beeper
        await connection.query(
            'UPDATE beepers SET status = ?, transaction_id = ?, assigned_at = NOW() WHERE beeper_number = ?',
            ['in-use', transactionId, beeperNumber]
        );

        await connection.commit();

        // Emit real-time beeper update via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('beepers:update', { beeper_number: beeperNumber, status: 'in-use' });
        }

        res.json({
            message: 'Order placed successfully',
            transaction_id: transactionId,
            beeper_number: beeperNumber
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Process payment for pending order
exports.processPayment = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        const { discount_id, discount_amount, cash_tendered, change_due } = req.body;
        const userId = req.user?.user_id || null;

        // Get original transaction to calculate final amount and check for library booking
        const [orders] = await connection.query(
            'SELECT total_amount, library_booking FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const originalTotal = parseFloat(orders[0].total_amount);
        const discountAmt = parseFloat(discount_amount) || 0;
        const finalTotal = Math.max(0, originalTotal - discountAmt);
        
        // Parse library booking if exists
        let libraryBooking = null;
        let librarySessionId = null;
        
        if (orders[0].library_booking) {
            try {
                libraryBooking = typeof orders[0].library_booking === 'string' 
                    ? JSON.parse(orders[0].library_booking) 
                    : orders[0].library_booking;
            } catch (e) {
                console.error('Error parsing library_booking:', e);
            }
        }
        
        // If there's a library booking, create the library session
        if (libraryBooking && libraryBooking.seat_id) {
            // Check if seat is still available
            const [seat] = await connection.query(
                'SELECT seat_id, status FROM library_seats WHERE seat_id = ?',
                [libraryBooking.seat_id]
            );
            
            if (seat.length > 0 && seat[0].status === 'available') {
                // Create library session
                const [sessionResult] = await connection.query(`
                    INSERT INTO library_sessions 
                    (seat_id, customer_name, paid_minutes, amount_paid, status, start_time) 
                    VALUES (?, ?, ?, ?, 'active', NOW())
                `, [
                    libraryBooking.seat_id,
                    libraryBooking.customer_name,
                    libraryBooking.duration_minutes,
                    libraryBooking.amount
                ]);
                
                librarySessionId = sessionResult.insertId;
                
                // Update seat status to occupied
                await connection.query(
                    'UPDATE library_seats SET status = "occupied" WHERE seat_id = ?',
                    [libraryBooking.seat_id]
                );
            }
        }

        // Update transaction
        await connection.query(`
            UPDATE transactions SET
                discount_id = ?,
                discount_amount = ?,
                total_amount = ?,
                cash_tendered = ?,
                change_due = ?,
                status = 'preparing',
                paid_at = NOW(),
                processed_by = ?
            WHERE transaction_id = ?
        `, [discount_id || null, discountAmt, finalTotal, cash_tendered, change_due, userId, id]);

        await connection.commit();

        res.json({ 
            message: 'Payment processed successfully',
            library_session_id: librarySessionId 
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Mark order as ready (trigger beeper)
exports.markReady = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE transactions SET status = ? WHERE transaction_id = ?',
            ['ready', id]
        );

        // TODO: Trigger physical beeper here if hardware is connected

        res.json({ message: 'Order marked as ready' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Complete order (beeper returned)
exports.completeOrder = async (req, res) => {
    try {
        const { id } = req.params;

        // Get beeper number
        const [orders] = await db.query(
            'SELECT beeper_number FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const beeperNumber = orders[0].beeper_number;

        // Update transaction
        await db.query(
            'UPDATE transactions SET status = ?, completed_at = NOW() WHERE transaction_id = ?',
            ['completed', id]
        );

        // Release beeper
        await releaseBeeper(beeperNumber);

        // Emit real-time beeper update via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('beepers:update', { beeper_number: beeperNumber, status: 'available' });
        }

        res.json({ message: 'Order completed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Void transaction
exports.voidTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const reason = req.body?.reason || 'No reason provided';
        // Use voided_by from request body if provided (admin verification), otherwise use logged in user
        const userId = req.body?.voided_by || req.user?.id || req.user?.user_id || null;

        // Get original transaction
        const [orders] = await db.query(
            'SELECT beeper_number, total_amount, status FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const { beeper_number, total_amount, status } = orders[0];

        // Check if already voided
        if (status === 'voided') {
            return res.status(400).json({ error: 'Transaction is already voided' });
        }

        // Update transaction
        await db.query(`
            UPDATE transactions SET
                status = 'voided',
                voided_by = ?,
                void_reason = ?,
                voided_at = NOW()
            WHERE transaction_id = ?
        `, [userId, reason, id]);

        // Log the void (wrap in try-catch)
        try {
            await db.query(`
                INSERT INTO void_log (transaction_id, beeper_number, voided_by, void_reason, original_amount)
                VALUES (?, ?, ?, ?, ?)
            `, [id, beeper_number, userId, reason, total_amount]);
        } catch (logError) {
            console.log('Void log insert skipped:', logError.message);
        }

        // Release beeper if exists
        if (beeper_number) {
            await releaseBeeper(beeper_number);

            // Emit real-time beeper update via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.emit('beepers:update', { beeper_number: beeper_number, status: 'available' });
            }
        }

        res.json({ success: true, message: 'Transaction voided successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get voided transactions with items - Filtered by user role
exports.getVoidedTransactions = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        let query = `
            SELECT 
                t.transaction_id,
                t.order_number,
                t.beeper_number,
                t.order_type,
                t.subtotal,
                t.discount_amount,
                t.total_amount,
                t.status,
                t.void_reason,
                t.voided_at,
                t.created_at,
                t.processed_by,
                u.full_name as voided_by_name,
                u.username as voided_by_username,
                pu.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.voided_by = u.user_id
            LEFT JOIN users pu ON t.processed_by = pu.user_id
            WHERE t.status = 'voided'
        `;
        
        const params = [];
        
        // If not admin, only show voided orders that were originally processed by this user
        if (!isAdmin && userId) {
            query += ` AND t.processed_by = ?`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.voided_at DESC LIMIT 100`;

        const [transactions] = await db.query(query, params);

        // Fetch items for each voided transaction
        for (let transaction of transactions) {
            const [items] = await db.query(`
                SELECT 
                    ti.item_id,
                    ti.quantity,
                    ti.unit_price,
                    ti.total_price,
                    i.name as item_name
                FROM transaction_items ti
                LEFT JOIN items i ON ti.item_id = i.item_id
                WHERE ti.transaction_id = ?
            `, [transaction.transaction_id]);
            
            transaction.items = items;
        }

        res.json({ transactions, isAdmin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get completed transactions (today) - Filtered by user role
exports.getCompletedTransactions = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        let query = `
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.status = 'completed'
            AND DATE(t.completed_at) = CURDATE()
        `;
        
        const params = [];
        
        // If not admin, only show orders processed by this user
        if (!isAdmin && userId) {
            query += ` AND t.processed_by = ?`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.completed_at DESC`;

        const [transactions] = await db.query(query, params);

        res.json({ transactions, isAdmin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get beepers status
exports.getBeepers = async (req, res) => {
    try {
        const [beepers] = await db.query('SELECT beeper_number, beeper_number as beeper_id, status, transaction_id, assigned_at FROM beepers ORDER BY beeper_number');
        res.json(beepers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get beeper configuration (total count)
exports.getBeeperConfig = async (req, res) => {
    try {
        const [beepers] = await db.query('SELECT COUNT(*) as total FROM beepers');
        const [available] = await db.query("SELECT COUNT(*) as available FROM beepers WHERE status = 'available'");
        const [inUse] = await db.query("SELECT COUNT(*) as in_use FROM beepers WHERE status = 'in-use'");
        
        res.json({
            total: beepers[0].total,
            available: available[0].available,
            in_use: inUse[0].in_use
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update beeper count (add or remove beepers)
exports.updateBeeperCount = async (req, res) => {
    const { count } = req.body;
    
    if (!count || count < 1 || count > 100) {
        return res.status(400).json({ error: 'Beeper count must be between 1 and 100' });
    }
    
    try {
        // Get current beeper count
        const [current] = await db.query('SELECT COUNT(*) as total FROM beepers');
        const currentCount = current[0].total;
        
        if (count > currentCount) {
            // Add more beepers
            const beepersToAdd = [];
            for (let i = currentCount + 1; i <= count; i++) {
                beepersToAdd.push([i, 'available', null, null]);
            }
            
            if (beepersToAdd.length > 0) {
                await db.query(
                    'INSERT INTO beepers (beeper_number, status, transaction_id, assigned_at) VALUES ?',
                    [beepersToAdd]
                );
            }
        } else if (count < currentCount) {
            // Check if beepers to be removed are in use
            const [inUseBeepers] = await db.query(
                "SELECT beeper_number FROM beepers WHERE beeper_number > ? AND status = 'in-use'",
                [count]
            );
            
            if (inUseBeepers.length > 0) {
                return res.status(400).json({ 
                    error: `Cannot remove beepers ${inUseBeepers.map(b => b.beeper_number).join(', ')} - they are currently in use` 
                });
            }
            
            // Remove beepers with higher numbers
            await db.query('DELETE FROM beepers WHERE beeper_number > ?', [count]);
        }
        
        res.json({ 
            message: `Beeper count updated to ${count}`,
            count: count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Release a specific beeper manually (make it available)
exports.releaseBeeperManually = async (req, res) => {
    const { beeperNumber } = req.params;
    
    try {
        // Check if beeper exists
        const [beeper] = await db.query(
            'SELECT * FROM beepers WHERE beeper_number = ?',
            [beeperNumber]
        );
        
        if (beeper.length === 0) {
            return res.status(404).json({ error: 'Beeper not found' });
        }
        
        if (beeper[0].status === 'available') {
            return res.status(400).json({ error: 'Beeper is already available' });
        }
        
        // Release the beeper
        await releaseBeeper(beeperNumber);
        
        res.json({ 
            success: true,
            message: `Beeper ${beeperNumber} has been released`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single transaction by ID
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [transactions] = await db.query(`
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.transaction_id = ?
        `, [id]);

        if (transactions.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = transactions[0];
        
        // Get items with base price
        const [items] = await db.query(`
            SELECT ti.*, i.name as item_name_db, i.price as base_price
            FROM transaction_items ti
            JOIN items i ON ti.item_id = i.item_id
            WHERE ti.transaction_id = ?
        `, [id]);

        // Get customizations for each item
        for (let item of items) {
            const [customizations] = await db.query(`
                SELECT * FROM transaction_item_customizations
                WHERE transaction_item_id = ?
            `, [item.transaction_item_id]);
            item.customizations = customizations;
        }

        transaction.items = items;
        
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get pending orders - Filtered by user role
exports.getPendingOrders = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        let query = `
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.status = 'pending'
        `;
        
        const params = [];
        
        // If not admin, only show pending orders from kiosk (processed_by IS NULL) 
        // OR processed by this user
        if (!isAdmin && userId) {
            query += ` AND (t.processed_by = ? OR t.processed_by IS NULL)`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.created_at ASC`;

        const [orders] = await db.query(query, params);

        // Get items and customizations for each order
        for (let order of orders) {
            const [items] = await db.query(`
                SELECT ti.*, i.name as item_name_db, i.price as base_price
                FROM transaction_items ti
                JOIN items i ON ti.item_id = i.item_id
                WHERE ti.transaction_id = ?
            `, [order.transaction_id]);

            // Get customizations for each item
            for (let item of items) {
                const [customizations] = await db.query(`
                    SELECT * FROM transaction_item_customizations
                    WHERE transaction_item_id = ?
                `, [item.transaction_item_id]);
                item.customizations = customizations;
            }

            order.items = items;
        }

        const formattedOrders = orders.map(order => ({
            id: order.transaction_id,
            transaction_id: order.transaction_id,
            order_number: order.order_number,
            beeper_number: order.beeper_number,
            order_type: order.order_type,
            subtotal: order.subtotal,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            items: order.items,
            library_booking: order.library_booking,
            processed_by_name: order.processed_by_name
        }));

        res.json(formattedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get ready orders - Filtered by user role
exports.getReadyOrders = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        let query = `
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.status = 'ready'
        `;
        
        const params = [];
        
        // If not admin, only show orders processed by this user
        if (!isAdmin && userId) {
            query += ` AND t.processed_by = ?`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.created_at ASC`;

        const [orders] = await db.query(query, params);

        const formattedOrders = orders.map(order => ({
            id: order.transaction_id,
            order_number: order.order_number,
            beeper_number: order.beeper_number,
            order_type: order.order_type,
            subtotal: order.subtotal,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            processed_by_name: order.processed_by_name
        }));

        res.json(formattedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get preparing orders - Filtered by user role
exports.getPreparingOrders = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const roleId = req.user?.role_id;
        const isAdmin = roleId === 1;

        let query = `
            SELECT t.*, u.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.processed_by = u.user_id
            WHERE t.status = 'preparing'
        `;
        
        const params = [];
        
        // If not admin, only show orders processed by this user
        if (!isAdmin && userId) {
            query += ` AND t.processed_by = ?`;
            params.push(userId);
        }
        
        query += ` ORDER BY t.created_at ASC`;

        const [orders] = await db.query(query, params);

        const formattedOrders = orders.map(order => ({
            id: order.transaction_id,
            order_number: order.order_number,
            beeper_number: order.beeper_number,
            order_type: order.order_type,
            subtotal: order.subtotal,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            processed_by_name: order.processed_by_name
        }));

        res.json(formattedOrders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Start preparing order
exports.startPreparing = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(`UPDATE transactions SET status = 'preparing' WHERE transaction_id = ?`, [id]);
        res.json({ success: true, message: 'Order is now being prepared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
