const db = require('../config/db');
const bcrypt = require('bcrypt');
const { normalizeAdminPin, verifyAdminPinAgainstAdmins } = require('../utils/adminPin');
const { computeTransactionTaxSnapshot } = require('../services/taxService');
const { getPriceUpdateSettings } = require('../services/priceScheduleService');

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

/** Loads VAT settings and returns 5 DB column values for a final inclusive total. */
async function buildTaxColumnValues(queryRunner, totalAmount) {
    const settings = await getPriceUpdateSettings(queryRunner);
    const snap = computeTransactionTaxSnapshot({
        totalIncl: totalAmount,
        vatEnabled: Boolean(settings.vat_enabled),
        vatRatePercent: Number(settings.vat_rate_percent)
    });
    return {
        vat_enabled_snapshot: snap.vat_enabled_snapshot,
        vat_rate_snapshot: snap.vat_rate_snapshot,
        vat_amount: snap.vat_amount,
        vatable_sales: snap.vatable_sales,
        non_vatable_sales: snap.non_vatable_sales
    };
}

const TAKEOUT_CUPS_SETTING_KEY = 'takeout_cups_stock';
const DEFAULT_TAKEOUT_CUP_STOCK = 200;
const MAX_TAKEOUT_CUP_STOCK = 100000;


// BEEPER MANAGEMENT

// Get next available beeper
// When called with a connection (inside a transaction), uses FOR UPDATE to prevent race conditions.
// When called without a connection (standalone), uses the shared pool (no lock).
const getAvailableBeeper = async (connection = null) => {
    const queryRunner = connection || db;
    const lockClause = connection ? ' FOR UPDATE' : '';
    const [beepers] = await queryRunner.query(
        'SELECT beeper_number FROM beepers WHERE status = ? ORDER BY beeper_number LIMIT 1' + lockClause,
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

const normalizeOrderType = (rawOrderType) => {
    const value = String(rawOrderType || '').trim().toLowerCase();
    if (value === 'dine_in' || value === 'dine-in') return 'dine-in';
    if (value === 'take_out' || value === 'takeout') return 'takeout';
    return value || 'dine-in';
};

const sanitizeNonNegativeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (Number.isNaN(parsed) || parsed < 0) return fallback;
    return parsed;
};

const parseStrictNonNegativeInteger = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
};

const extractPositiveWholeQuantity = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
};

const ensureTakeoutCupSetting = async (queryRunner) => {
    await queryRunner.query(
        `
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = setting_value
        `,
        [TAKEOUT_CUPS_SETTING_KEY, String(DEFAULT_TAKEOUT_CUP_STOCK)]
    );
};

const getTakeoutCupStock = async (queryRunner, { lock = false } = {}) => {
    await ensureTakeoutCupSetting(queryRunner);

    const lockClause = lock ? ' FOR UPDATE' : '';
    const [rows] = await queryRunner.query(
        `
        SELECT setting_value
        FROM system_settings
        WHERE setting_key = ?
        LIMIT 1${lockClause}
        `,
        [TAKEOUT_CUPS_SETTING_KEY]
    );

    return sanitizeNonNegativeInt(rows?.[0]?.setting_value, DEFAULT_TAKEOUT_CUP_STOCK);
};

const buildInsufficientCupError = ({ cupsNeeded, cupsAvailable }) => {
    const error = new Error(
        `Insufficient takeout cups. Required ${cupsNeeded}, available ${cupsAvailable}.`
    );
    error.code = 'INSUFFICIENT_TAKEOUT_CUPS';
    error.statusCode = 409;
    error.cups_needed = cupsNeeded;
    error.cups_available = cupsAvailable;
    return error;
};

const calculateTakeoutCupsFromPayload = async (queryRunner, rawItems = []) => {
    const lineItems = (Array.isArray(rawItems) ? rawItems : [])
        .map((item) => ({
            itemId: Number(item?.item_id),
            quantity: extractPositiveWholeQuantity(item?.quantity)
        }))
        .filter((item) => Number.isInteger(item.itemId) && item.itemId > 0 && item.quantity > 0);

    if (lineItems.length === 0) return 0;

    const uniqueItemIds = [...new Set(lineItems.map((item) => item.itemId))];
    const placeholders = uniqueItemIds.map(() => '?').join(', ');
    const [rows] = await queryRunner.query(
        `
        SELECT i.item_id, COALESCE(c.requires_takeout_cup, 1) AS requires_takeout_cup
        FROM items i
        JOIN categories c ON c.category_id = i.category_id
        WHERE i.item_id IN (${placeholders})
        `,
        uniqueItemIds
    );

    const cupFlagByItem = new Map(
        rows.map((row) => [Number(row.item_id), Number(row.requires_takeout_cup) === 1])
    );

    return lineItems.reduce((sum, item) => {
        const requiresCup = cupFlagByItem.get(item.itemId);
        if (requiresCup === false) return sum;
        return sum + item.quantity;
    }, 0);
};

const calculateTakeoutCupsFromTransaction = async (queryRunner, transactionId) => {
    const [rows] = await queryRunner.query(
        `
        SELECT COALESCE(
            SUM(
                CASE WHEN COALESCE(c.requires_takeout_cup, 1) = 1
                THEN ti.quantity
                ELSE 0 END
            ),
            0
        ) AS cups_needed
        FROM transaction_items ti
        JOIN items i ON i.item_id = ti.item_id
        JOIN categories c ON c.category_id = i.category_id
        WHERE ti.transaction_id = ?
        `,
        [transactionId]
    );

    return sanitizeNonNegativeInt(rows?.[0]?.cups_needed, 0);
};

const ensureTakeoutCupCapacity = async ({ queryRunner, orderType, cupsNeeded, deduct = false }) => {
    const normalizedOrderType = normalizeOrderType(orderType);
    const needed = sanitizeNonNegativeInt(cupsNeeded, 0);

    if (normalizedOrderType !== 'takeout' || needed <= 0) {
        return {
            cups_needed: 0,
            cups_available: null,
            cups_after: null,
            deducted: false
        };
    }

    const cupsAvailable = await getTakeoutCupStock(queryRunner, { lock: deduct });
    if (cupsAvailable < needed) {
        throw buildInsufficientCupError({ cupsNeeded: needed, cupsAvailable });
    }

    let cupsAfter = cupsAvailable;
    if (deduct) {
        cupsAfter = cupsAvailable - needed;
        await queryRunner.query(
            'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
            [String(cupsAfter), TAKEOUT_CUPS_SETTING_KEY]
        );
    }

    return {
        cups_needed: needed,
        cups_available: cupsAvailable,
        cups_after: cupsAfter,
        deducted: deduct
    };
};

// Determine admin role from JWT payload in a backward-compatible way.
const isAdminUser = (user) => {
    if (!user) return false;

    // Keep support for legacy payloads that still include role_id.
    const roleId = Number(user.role_id);
    if (!Number.isNaN(roleId) && roleId === 1) return true;

    const roleName = String(user.role || user.role_name || '').trim().toLowerCase();
    return roleName === 'admin';
};

const getRequestUserId = (req) => req.user?.user_id || req.user?.id || null;

const canAccessTransaction = ({ req, transaction, allowUnassigned = false }) => {
    if (isAdminUser(req.user)) {
        return true;
    }

    const rawUserId = getRequestUserId(req);
    if (rawUserId == null) {
        return false;
    }

    const userId = Number(rawUserId);
    if (Number.isNaN(userId)) {
        return false;
    }

    const ownerId = transaction?.processed_by == null ? null : Number(transaction.processed_by);
    if (ownerId === userId) {
        return true;
    }

    if (allowUnassigned && ownerId == null) {
        return true;
    }

    return false;
};

const denyOwnership = (res) =>
    res.status(403).json({ error: 'Access denied. You can only modify your own transactions.' });

const authorizeSensitiveActionByPin = async ({ queryRunner, adminPin }) => {
    const verification = await verifyAdminPinAgainstAdmins({
        queryRunner,
        bcryptLib: bcrypt,
        pin: normalizeAdminPin(adminPin)
    });

    if (!verification.valid) {
        return { authorized: false, status: verification.status, error: verification.error };
    }

    return {
        authorized: true,
        authorizedById: verification.admin.id
    };
};


// VAT display for POS (current system settings; not per-transaction snapshot)

exports.getTaxDisplay = async (req, res) => {
    try {
        const settings = await getPriceUpdateSettings(db);
        res.json({
            vat_enabled: Boolean(settings.vat_enabled),
            vat_rate_percent: Number(settings.vat_rate_percent) || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

exports.getTakeoutCupsStatus = async (req, res) => {
    try {
        const requiredCups = sanitizeNonNegativeInt(req.query?.required_cups, 0);
        const stock = await getTakeoutCupStock(db);
        const isTakeoutDisabled = stock <= 0 || (requiredCups > 0 && requiredCups > stock);
        const canFulfill = requiredCups > 0 ? requiredCups <= stock : stock > 0;

        res.json({
            stock,
            is_takeout_disabled: isTakeoutDisabled,
            required_cups: requiredCups,
            can_fulfill: canFulfill
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTakeoutCupsStock = async (req, res) => {
    try {
        const requestedStock = parseStrictNonNegativeInteger(
            req.body?.stock ?? req.body?.takeout_cups_stock
        );

        if (requestedStock === null) {
            return res.status(400).json({ error: 'Stock must be a non-negative whole number.' });
        }

        if (requestedStock > MAX_TAKEOUT_CUP_STOCK) {
            return res.status(400).json({ error: `Stock cannot exceed ${MAX_TAKEOUT_CUP_STOCK}.` });
        }

        await ensureTakeoutCupSetting(db);
        await db.query(
            'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
            [String(requestedStock), TAKEOUT_CUPS_SETTING_KEY]
        );

        res.json({
            message: 'Takeout cup stock updated successfully.',
            stock: requestedStock,
            is_takeout_disabled: requestedStock <= 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// TRANSACTIONS

// Get all orders (for POS display) - Filtered by user role
exports.getOrders = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const isAdmin = isAdminUser(req.user);

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

        const normalizedOrderType = normalizeOrderType(order_type);
        const takeoutCupsNeeded = await calculateTakeoutCupsFromPayload(connection, items);
        const cupReservation = await ensureTakeoutCupCapacity({
            queryRunner: connection,
            orderType: normalizedOrderType,
            cupsNeeded: takeoutCupsNeeded,
            deduct: true
        });

        // Get beeper number - either from provided beeper_id or get next available
        let beeperNumber;
        if (beeper_id) {
            const [beeper] = await connection.query(
                'SELECT beeper_number FROM beepers WHERE beeper_number = ? AND status = ? FOR UPDATE',
                [beeper_id, 'available']
            );
            if (beeper.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Selected beeper is not available.' });
            }
            beeperNumber = beeper[0].beeper_number;
        } else {
            beeperNumber = await getAvailableBeeper(connection);
            if (!beeperNumber) {
                await connection.rollback();
                return res.status(400).json({ error: 'No beepers available. Please wait.' });
            }
        }

        // Get user ID from token (if authenticated) or null for kiosk
        const userId = req.user?.user_id || null;

        const taxCols = await buildTaxColumnValues(connection, parseFloat(total_amount));

        // Create transaction
        const [result] = await connection.query(`
            INSERT INTO transactions (
                beeper_number, order_type, subtotal, discount_id, discount_amount,
                total_amount,
                vat_enabled_snapshot, vat_rate_snapshot, vat_amount, vatable_sales, non_vatable_sales,
                cash_tendered, change_due, status, paid_at, processed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `, [
            beeperNumber,
            normalizedOrderType,
            subtotal,
            discount_id || null,
            discount_amount || 0,
            total_amount,
            taxCols.vat_enabled_snapshot,
            taxCols.vat_rate_snapshot,
            taxCols.vat_amount,
            taxCols.vatable_sales,
            taxCols.non_vatable_sales,
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
            beeper_number: beeperNumber,
            cups: cupReservation
        });
    } catch (error) {
        await connection.rollback();
        if (error?.code === 'INSUFFICIENT_TAKEOUT_CUPS') {
            return res.status(error.statusCode || 409).json({
                error: error.message,
                code: error.code,
                cups_needed: error.cups_needed,
                cups_available: error.cups_available
            });
        }
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

        let normalizedOrderType = normalizeOrderType(order_type);
        const takeoutCupsNeeded = await calculateTakeoutCupsFromPayload(connection, items);
        const cupAvailability = await ensureTakeoutCupCapacity({
            queryRunner: connection,
            orderType: normalizedOrderType,
            cupsNeeded: takeoutCupsNeeded,
            deduct: false
        });

        // Get available beeper (with row lock to prevent race conditions)
        const beeperNumber = await getAvailableBeeper(connection);
        if (!beeperNumber) {
            await connection.rollback();
            return res.status(400).json({ error: 'No beepers available. Please wait.' });
        }

        // If a library booking is attached, do rigid checks immediately
        if (library_booking && library_booking.seat_id) {
            // 1. Check physical seat status in DB
            const [seat] = await connection.query(
                'SELECT seat_id, status FROM library_seats WHERE seat_id = ? FOR UPDATE',
                [library_booking.seat_id]
            );
            
            if (seat.length === 0 || seat[0].status !== 'available') {
                await connection.rollback();
                return res.status(400).json({ error: 'This seat is already occupied or under maintenance.' });
            }

            // 2. Check if another 'pending' order already claimed this seat
            const [existingPending] = await connection.query(`
                SELECT transaction_id FROM transactions 
                WHERE status = 'pending' 
                AND library_booking IS NOT NULL 
                AND JSON_EXTRACT(library_booking, "$.seat_id") = ?
                FOR UPDATE
            `, [library_booking.seat_id]);

            if (existingPending.length > 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'This seat was just reserved by another pending customer order. Please select a different seat.' });
            }
        }

        const pendingTax = await buildTaxColumnValues(connection, parseFloat(total_amount));

        // Create transaction with pending status
        // Include library_booking JSON if present
        const [result] = await connection.query(`
            INSERT INTO transactions (
                beeper_number, order_type, subtotal, total_amount,
                vat_enabled_snapshot, vat_rate_snapshot, vat_amount, vatable_sales, non_vatable_sales,
                status, library_booking
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            beeperNumber,
            normalizedOrderType,
            subtotal,
            total_amount,
            pendingTax.vat_enabled_snapshot,
            pendingTax.vat_rate_snapshot,
            pendingTax.vat_amount,
            pendingTax.vatable_sales,
            pendingTax.non_vatable_sales,
            'pending',
            library_booking ? JSON.stringify(library_booking) : null
        ]);

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
        const lockedSeats = req.app.get('lockedSeats');
        if (io) {
            io.emit('beepers:update', { beeper_number: beeperNumber, status: 'in-use' });
            // Drop any transient Kiosk locks for this seat now that it is officially recorded in the DB
            if (library_booking && library_booking.seat_id) {
                const seatId = library_booking.seat_id;
                if (lockedSeats && lockedSeats.has(seatId)) {
                    lockedSeats.delete(seatId);
                }
                // Inform clients the temporary lock resolved (the DB public poll will handle "reserved" state now)
                io.emit('seat:released', { seat_id: seatId });
                io.to('library-room').emit('library:seats-update', { action: 'reserved' });
            }
        }

        res.json({
            message: 'Order placed successfully',
            transaction_id: transactionId,
            beeper_number: beeperNumber,
            cups: cupAvailability
        });
    } catch (error) {
        await connection.rollback();
        if (error?.code === 'INSUFFICIENT_TAKEOUT_CUPS') {
            return res.status(error.statusCode || 409).json({
                error: error.message,
                code: error.code,
                cups_needed: error.cups_needed,
                cups_available: error.cups_available
            });
        }
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
        const userId = getRequestUserId(req);

        // Get original transaction to calculate final amount and check for library booking
        const [orders] = await connection.query(
            'SELECT total_amount, library_booking, processed_by, status, order_type FROM transactions WHERE transaction_id = ? FOR UPDATE',
            [id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = orders[0];
        if (!canAccessTransaction({ req, transaction, allowUnassigned: true })) {
            await connection.rollback();
            return denyOwnership(res);
        }

        if (transaction.status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ error: 'Only pending transactions can be paid.' });
        }

        const originalTotal = parseFloat(transaction.total_amount);
        const discountAmt = parseFloat(discount_amount) || 0;
        const finalTotal = Math.max(0, originalTotal - discountAmt);
        const payTax = await buildTaxColumnValues(connection, finalTotal);
        const takeoutCupsNeeded = await calculateTakeoutCupsFromTransaction(connection, id);
        const cupReservation = await ensureTakeoutCupCapacity({
            queryRunner: connection,
            orderType: transaction.order_type,
            cupsNeeded: takeoutCupsNeeded,
            deduct: true
        });
        
        // Parse library booking if exists
        let libraryBooking = null;
        let librarySessionId = null;
        
        if (transaction.library_booking) {
            try {
                libraryBooking = typeof transaction.library_booking === 'string' 
                    ? JSON.parse(transaction.library_booking) 
                    : transaction.library_booking;
            } catch (e) {
                console.error('Error parsing library_booking:', e);
            }
        }
        
        // If there's a library booking, create the library session
        if (libraryBooking && libraryBooking.seat_id) {
            // Check if seat is still available (with row lock to prevent race conditions)
            const [seat] = await connection.query(
                'SELECT seat_id, status FROM library_seats WHERE seat_id = ? FOR UPDATE',
                [libraryBooking.seat_id]
            );
            
            if (seat.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'Selected seat no longer exists.' });
            }
            
            if (seat[0].status !== 'available') {
                await connection.rollback();
                return res.status(400).json({ error: `Seat is no longer available (currently ${seat[0].status}). Please select a different seat.` });
            }
            
            // Create library session
            const [sessionResult] = await connection.query(`
                INSERT INTO library_sessions 
                (seat_id, customer_name, paid_minutes, amount_paid, status, start_time, processed_by) 
                VALUES (?, ?, ?, ?, 'active', NOW(), ?)
            `, [
                libraryBooking.seat_id,
                libraryBooking.customer_name,
                libraryBooking.duration_minutes,
                libraryBooking.amount,
                transaction.processed_by || userId || null
            ]);
            
            librarySessionId = sessionResult.insertId;
            
            // Update seat status to occupied
            await connection.query(
                'UPDATE library_seats SET status = "occupied" WHERE seat_id = ?',
                [libraryBooking.seat_id]
            );
        }

        // Update transaction
        await connection.query(`
            UPDATE transactions SET
                discount_id = ?,
                discount_amount = ?,
                total_amount = ?,
                vat_enabled_snapshot = ?,
                vat_rate_snapshot = ?,
                vat_amount = ?,
                vatable_sales = ?,
                non_vatable_sales = ?,
                cash_tendered = ?,
                change_due = ?,
                status = 'preparing',
                paid_at = NOW(),
                processed_by = COALESCE(processed_by, ?)
            WHERE transaction_id = ?
        `, [
            discount_id || null,
            discountAmt,
            finalTotal,
            payTax.vat_enabled_snapshot,
            payTax.vat_rate_snapshot,
            payTax.vat_amount,
            payTax.vatable_sales,
            payTax.non_vatable_sales,
            cash_tendered,
            change_due,
            userId,
            id
        ]);

        await connection.commit();

        res.json({ 
            message: 'Payment processed successfully',
            library_session_id: librarySessionId,
            cups: cupReservation
        });
    } catch (error) {
        await connection.rollback();
        if (error?.code === 'INSUFFICIENT_TAKEOUT_CUPS') {
            return res.status(error.statusCode || 409).json({
                error: error.message,
                code: error.code,
                cups_needed: error.cups_needed,
                cups_available: error.cups_available
            });
        }
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Mark order as ready (trigger beeper)
exports.markReady = async (req, res) => {
    try {
        const { id } = req.params;

        const [orders] = await db.query(
            'SELECT transaction_id, processed_by, status FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];
        if (!canAccessTransaction({ req, transaction: order, allowUnassigned: true })) {
            return denyOwnership(res);
        }

        if (['voided', 'refunded', 'completed'].includes(order.status)) {
            return res.status(400).json({ error: 'Order is already finalized and cannot be marked ready.' });
        }

        const userId = getRequestUserId(req);

        await db.query(
            'UPDATE transactions SET status = ?, processed_by = COALESCE(processed_by, ?) WHERE transaction_id = ?',
            ['ready', userId, id]
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
        const userId = getRequestUserId(req);

        // Get beeper number and ownership metadata
        const [orders] = await db.query(
            'SELECT beeper_number, processed_by, status FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];
        if (!canAccessTransaction({ req, transaction: order, allowUnassigned: true })) {
            return denyOwnership(res);
        }

        if (['voided', 'refunded', 'completed'].includes(order.status)) {
            return res.status(400).json({ error: 'Order is already finalized and cannot be completed.' });
        }

        const beeperNumber = order.beeper_number;

        // Update transaction
        await db.query(
            'UPDATE transactions SET status = ?, completed_at = NOW(), processed_by = COALESCE(processed_by, ?) WHERE transaction_id = ?',
            ['completed', userId, id]
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
        const adminPin = req.body?.admin_pin || req.body?.adminPin || req.body?.pin;

        const pinAuth = await authorizeSensitiveActionByPin({ queryRunner: db, adminPin });
        if (!pinAuth.authorized) {
            return res.status(pinAuth.status).json({ error: pinAuth.error });
        }

        const authorizedById = pinAuth.authorizedById;

        // Get original transaction
        const [orders] = await db.query(
            'SELECT beeper_number, total_amount, status, processed_by FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = orders[0];
        const { beeper_number, total_amount, status } = transaction;

        if (!canAccessTransaction({ req, transaction, allowUnassigned: true })) {
            return denyOwnership(res);
        }

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
        `, [authorizedById, reason, id]);

        // Log the void (wrap in try-catch)
        try {
            await db.query(`
                INSERT INTO void_log (transaction_id, beeper_number, voided_by, void_reason, original_amount)
                VALUES (?, ?, ?, ?, ?)
            `, [id, beeper_number, authorizedById, reason, total_amount]);
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

// Remove specific items from a pending transaction (partial void)
exports.removeItemsFromPending = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const { id } = req.params;
        const { transaction_item_ids, void_library, reason } = req.body;
        const adminPin = req.body?.admin_pin || req.body?.adminPin || req.body?.pin;
        const userId = getRequestUserId(req);

        const pinAuth = await authorizeSensitiveActionByPin({ queryRunner: connection, adminPin });
        if (!pinAuth.authorized) {
            await connection.rollback();
            return res.status(pinAuth.status).json({ error: pinAuth.error });
        }

        const authorizedById = pinAuth.authorizedById;

        // Get the transaction
        const [orders] = await connection.query(
            'SELECT * FROM transactions WHERE transaction_id = ? FOR UPDATE',
            [id]
        );

        if (orders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const order = orders[0];
        if (!canAccessTransaction({ req, transaction: order, allowUnassigned: true })) {
            await connection.rollback();
            return denyOwnership(res);
        }

        if (order.status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({ error: 'Can only remove items from pending orders' });
        }

        // Attribute unassigned kiosk orders to the acting cashier/admin.
        await connection.query(
            'UPDATE transactions SET processed_by = COALESCE(processed_by, ?) WHERE transaction_id = ?',
            [userId, id]
        );

        // Remove specified transaction items and their customizations
        if (transaction_item_ids && transaction_item_ids.length > 0) {
            for (const tiId of transaction_item_ids) {
                // Delete customizations first (FK constraint)
                await connection.query(
                    'DELETE FROM transaction_item_customizations WHERE transaction_item_id = ?',
                    [tiId]
                );
                // Delete the transaction item
                await connection.query(
                    'DELETE FROM transaction_items WHERE id = ? AND transaction_id = ?',
                    [tiId, id]
                );
            }
        }

        // Handle library booking void
        if (void_library) {
            // Release the seat if library booking had a seat
            let libraryBooking = null;
            if (order.library_booking) {
                try {
                    libraryBooking = typeof order.library_booking === 'string' 
                        ? JSON.parse(order.library_booking) 
                        : order.library_booking;
                } catch(e) { /* ignore parse errors */ }
            }
            
            if (libraryBooking && libraryBooking.seat_id) {
                const io = req.app.get('io');
                if (io) {
                    io.emit('seat:released', { seat_id: libraryBooking.seat_id });
                    io.to('library-room').emit('library:seats-update', { action: 'released' });
                }
            }

            await connection.query(
                'UPDATE transactions SET library_booking = NULL WHERE transaction_id = ?',
                [id]
            );
        }

        // Check remaining items
        const [remainingItems] = await connection.query(
            'SELECT ti.id as transaction_item_id, ti.item_name, ti.quantity, ti.unit_price, ti.total_price FROM transaction_items ti WHERE ti.transaction_id = ?',
            [id]
        );

        // Check remaining library booking
        const [updatedOrder] = await connection.query(
            'SELECT library_booking FROM transactions WHERE transaction_id = ?',
            [id]
        );
        const hasLibraryBooking = updatedOrder[0]?.library_booking != null;

        if (remainingItems.length === 0 && !hasLibraryBooking) {
            // Nothing left — void the entire transaction
            await connection.query(`
                UPDATE transactions SET
                    status = 'voided',
                    voided_by = ?,
                    void_reason = ?,
                    voided_at = NOW()
                WHERE transaction_id = ?
            `, [authorizedById, reason || 'All items removed', id]);

            // Release beeper
            if (order.beeper_number) {
                await connection.query(
                    "UPDATE beepers SET status = 'available', transaction_id = NULL, assigned_at = NULL WHERE beeper_number = ?",
                    [order.beeper_number]
                );
                const io = req.app.get('io');
                if (io) {
                    io.emit('beepers:update', { beeper_number: order.beeper_number, status: 'available' });
                }
            }

            // Log the void
            try {
                await connection.query(`
                    INSERT INTO void_log (transaction_id, beeper_number, voided_by, void_reason, original_amount)
                    VALUES (?, ?, ?, ?, ?)
                `, [id, order.beeper_number, authorizedById, reason || 'All items removed', order.total_amount]);
            } catch(logErr) { /* ignore */ }

            await connection.commit();
            return res.json({ 
                success: true, 
                fully_voided: true, 
                message: 'All items removed — order voided' 
            });
        }

        // Recalculate totals from remaining items
        let newSubtotal = remainingItems.reduce((sum, item) => {
            return sum + parseFloat(item.total_price || 0);
        }, 0);

        // Add library booking amount if still present
        if (hasLibraryBooking && updatedOrder[0].library_booking) {
            try {
                const lb = typeof updatedOrder[0].library_booking === 'string'
                    ? JSON.parse(updatedOrder[0].library_booking)
                    : updatedOrder[0].library_booking;
                newSubtotal += parseFloat(lb.amount || 0);
            } catch(e) { /* ignore */ }
        }

        const partialTax = await buildTaxColumnValues(connection, newSubtotal);
        await connection.query(
            `UPDATE transactions SET
                subtotal = ?,
                total_amount = ?,
                vat_enabled_snapshot = ?,
                vat_rate_snapshot = ?,
                vat_amount = ?,
                vatable_sales = ?,
                non_vatable_sales = ?
            WHERE transaction_id = ?`,
            [
                newSubtotal,
                newSubtotal,
                partialTax.vat_enabled_snapshot,
                partialTax.vat_rate_snapshot,
                partialTax.vat_amount,
                partialTax.vatable_sales,
                partialTax.non_vatable_sales,
                id
            ]
        );

        await connection.commit();

        // Return updated order data for the frontend to reload
        res.json({ 
            success: true, 
            fully_voided: false, 
            message: `${transaction_item_ids?.length || 0} item(s) removed`,
            remaining_items: remainingItems,
            new_total: newSubtotal
        });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Get refunded transactions with items
exports.getRefundedTransactions = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const isAdmin = isAdminUser(req.user);

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
                t.void_reason as refund_reason,
                t.voided_at as refunded_at,
                t.created_at,
                t.processed_by,
                u.full_name as refunded_by_name,
                u.username as refunded_by_username,
                pu.full_name as processed_by_name
            FROM transactions t
            LEFT JOIN users u ON t.voided_by = u.user_id
            LEFT JOIN users pu ON t.processed_by = pu.user_id
            WHERE t.status = 'refunded'
        `;

        const params = [];

        // If not admin, only show refunded orders that were originally processed by this user.
        if (!isAdmin && userId) {
            query += ` AND t.processed_by = ?`;
            params.push(userId);
        }

        query += ` ORDER BY t.voided_at DESC LIMIT 100`;

        const [transactions] = await db.query(query, params);

        // Fetch items for each refunded transaction
        for (let transaction of transactions) {
            const [items] = await db.query(`
                SELECT 
                    ti.item_id,
                    ti.item_name,
                    ti.quantity,
                    ti.unit_price,
                    ti.total_price
                FROM transaction_items ti
                WHERE ti.transaction_id = ?
            `, [transaction.transaction_id]);
            transaction.items = items;
        }

        res.json({ transactions, isAdmin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get voided transactions with items - Filtered by user role
exports.getVoidedTransactions = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const isAdmin = isAdminUser(req.user);

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
        const isAdmin = isAdminUser(req.user);

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
        // Auto-cleanup: release beepers stuck on completed/voided/old transactions
        await db.query(`
            UPDATE beepers b
            LEFT JOIN transactions t ON b.transaction_id = t.transaction_id
            SET b.status = 'available', b.transaction_id = NULL, b.assigned_at = NULL
            WHERE b.status = 'in-use'
            AND (
                t.transaction_id IS NULL
                OR t.status IN ('completed', 'voided')
                OR DATE(t.created_at) < CURDATE()
            )
        `);

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

// Reset all beepers — release any stuck beepers (tied to completed/voided/old orders)
exports.resetAllBeepers = async (req, res) => {
    try {
        // Release beepers whose linked transaction is already completed or voided
        const [stuckCompleted] = await db.query(`
            UPDATE beepers b
            JOIN transactions t ON b.transaction_id = t.transaction_id
            SET b.status = 'available', b.transaction_id = NULL, b.assigned_at = NULL
            WHERE b.status = 'in-use'
            AND t.status IN ('completed', 'voided')
        `);

        // Release beepers whose linked transaction no longer exists
        const [stuckOrphan] = await db.query(`
            UPDATE beepers b
            LEFT JOIN transactions t ON b.transaction_id = t.transaction_id
            SET b.status = 'available', b.transaction_id = NULL, b.assigned_at = NULL
            WHERE b.status = 'in-use'
            AND t.transaction_id IS NULL
        `);

        // Release beepers assigned to orders from previous days (stale)
        const [stuckOld] = await db.query(`
            UPDATE beepers b
            JOIN transactions t ON b.transaction_id = t.transaction_id
            SET b.status = 'available', b.transaction_id = NULL, b.assigned_at = NULL
            WHERE b.status = 'in-use'
            AND DATE(t.created_at) < CURDATE()
        `);

        const totalReleased = (stuckCompleted.affectedRows || 0) + (stuckOrphan.affectedRows || 0) + (stuckOld.affectedRows || 0);

        res.json({
            success: true,
            message: `Released ${totalReleased} stuck beeper(s)`,
            details: {
                completed_voided: stuckCompleted.affectedRows || 0,
                orphaned: stuckOrphan.affectedRows || 0,
                stale_old_days: stuckOld.affectedRows || 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single transaction by ID
exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = isAdminUser(req.user);
        
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

        if (!isAdmin && !canAccessTransaction({ req, transaction, allowUnassigned: true })) {
            return res.status(403).json({ error: 'Access denied. You can only view your own transactions.' });
        }
        
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
        const isAdmin = isAdminUser(req.user);

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
                SELECT ti.*, i.name as item_name_db, i.price as base_price, COALESCE(c.requires_takeout_cup, 1) as requires_takeout_cup
                FROM transaction_items ti
                JOIN items i ON ti.item_id = i.item_id
                JOIN categories c ON c.category_id = i.category_id
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
        const isAdmin = isAdminUser(req.user);

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
        const isAdmin = isAdminUser(req.user);

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
        const userId = getRequestUserId(req);

        const [orders] = await db.query(
            'SELECT transaction_id, processed_by, status FROM transactions WHERE transaction_id = ?',
            [id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];
        if (!canAccessTransaction({ req, transaction: order, allowUnassigned: true })) {
            return denyOwnership(res);
        }

        if (['voided', 'refunded', 'completed'].includes(order.status)) {
            return res.status(400).json({ error: 'Order is already finalized and cannot be prepared.' });
        }

        await db.query(
            `UPDATE transactions SET status = 'preparing', processed_by = COALESCE(processed_by, ?) WHERE transaction_id = ?`,
            [userId, id]
        );
        res.json({ success: true, message: 'Order is now being prepared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



// Refund a transaction
exports.refundTransaction = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { reason, refundedItems, refundLibrary, refundMethod } = req.body;
        const adminPin = req.body?.admin_pin || req.body?.adminPin || req.body?.pin;

        const pinAuth = await authorizeSensitiveActionByPin({ queryRunner: connection, adminPin });
        if (!pinAuth.authorized) {
            await connection.rollback();
            return res.status(pinAuth.status).json({ error: pinAuth.error });
        }

        const authorizedById = pinAuth.authorizedById;

        // Find transaction
        const [transactions] = await connection.query(
            'SELECT * FROM transactions WHERE transaction_id = ? OR order_number = ?',
            [id, id]
        );

        if (transactions.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const transaction = transactions[0];

        if (!canAccessTransaction({ req, transaction, allowUnassigned: false })) {
            await connection.rollback();
            return denyOwnership(res);
        }

        // Ensure not already refunded/voided
        if (transaction.status === 'voided' || transaction.status === 'refunded') {
            await connection.rollback();
            return res.status(400).json({ error: 'Transaction is already voided or refunded' });
        }

        const normalizedRefundMethod = String(refundMethod || 'cash').toLowerCase() === 'item' ? 'item' : 'cash';

        let refundAmount = 0;
        const selectedItemIds = Array.isArray(refundedItems)
            ? refundedItems.map((itemId) => Number(itemId)).filter((itemId) => Number.isInteger(itemId) && itemId > 0)
            : [];

        if (selectedItemIds.length > 0) {
            const placeholders = selectedItemIds.map(() => '?').join(', ');
            const [refundItemTotals] = await connection.query(
                `
                SELECT COALESCE(SUM(ti.total_price), 0) as refund_amount
                FROM transaction_items ti
                WHERE ti.transaction_id = ?
                AND ti.transaction_item_id IN (${placeholders})
                `,
                [transaction.transaction_id, ...selectedItemIds]
            );
            refundAmount += parseFloat(refundItemTotals?.[0]?.refund_amount || 0);
        }

        if (refundLibrary && transaction.library_booking) {
            try {
                const booking = typeof transaction.library_booking === 'string'
                    ? JSON.parse(transaction.library_booking)
                    : transaction.library_booking;
                refundAmount += parseFloat(booking?.amount || booking?.amount_paid || 0) || 0;
            } catch (_error) {
                // Ignore malformed legacy booking payloads.
            }
        }

        if (refundAmount <= 0) {
            refundAmount = parseFloat(transaction.total_amount || 0);
        }

        const cashRefundAmount = normalizedRefundMethod === 'cash' ? refundAmount : 0;

        await connection.query(
            `UPDATE transactions 
             SET status = 'refunded', 
                 void_reason = CONCAT(IFNULL(void_reason, ''), ' [REFUNDED: ', ?, '] [METHOD: ', ?, '] [CASH_REFUND: ', ?, ']'),
                 voided_by = ?,
                 voided_at = CURRENT_TIMESTAMP
             WHERE transaction_id = ?`,
            [
                reason || 'Customer requested refund',
                normalizedRefundMethod,
                cashRefundAmount.toFixed(2),
                authorizedById,
                transaction.transaction_id
            ]
        );

        try {
            await connection.query(
                `
                INSERT INTO void_log (
                    transaction_id,
                    beeper_number,
                    voided_by,
                    void_reason,
                    original_amount,
                    action_type,
                    refund_amount
                ) VALUES (?, ?, ?, ?, ?, 'refund', ?)
                `,
                [
                    transaction.transaction_id,
                    transaction.beeper_number || 0,
                    authorizedById,
                    reason || 'Customer requested refund',
                    parseFloat(transaction.total_amount || 0),
                    cashRefundAmount
                ]
            );
        } catch (voidLogError) {
            // Backward compatibility for environments without new void_log columns.
            await connection.query(
                `
                INSERT INTO void_log (
                    transaction_id,
                    beeper_number,
                    voided_by,
                    void_reason,
                    original_amount
                ) VALUES (?, ?, ?, ?, ?)
                `,
                [
                    transaction.transaction_id,
                    transaction.beeper_number || 0,
                    authorizedById,
                    reason || 'Customer requested refund',
                    parseFloat(transaction.total_amount || 0)
                ]
            );
            console.warn('void_log refund metadata skipped:', voidLogError.message);
        }

        await connection.commit();

        const origTotalAmt = parseFloat(transaction.total_amount || 0);
        const origVat = parseFloat(transaction.vat_amount || 0);
        const origVatable = parseFloat(transaction.vatable_sales || 0);
        const origNonVat = parseFloat(transaction.non_vatable_sales || 0);
        let tax_breakdown = {
            vat_amount: 0,
            vatable_sales: 0,
            non_vatable_sales: 0,
            net_vatable_sales: 0,
            vat_rate_snapshot: transaction.vat_rate_snapshot != null ? parseFloat(transaction.vat_rate_snapshot) : null
        };
        if (origTotalAmt > 0 && refundAmount > 0) {
            const ratio = refundAmount / origTotalAmt;
            tax_breakdown = {
                vat_amount: roundMoney(origVat * ratio),
                vatable_sales: roundMoney(origVatable * ratio),
                non_vatable_sales: roundMoney(origNonVat * ratio),
                net_vatable_sales: roundMoney((origVatable - origVat) * ratio),
                vat_rate_snapshot: transaction.vat_rate_snapshot != null ? parseFloat(transaction.vat_rate_snapshot) : null
            };
        }

        res.json({
            success: true,
            message: `Transaction refunded successfully (${normalizedRefundMethod === 'item' ? 'item replacement' : 'cash return'})`,
            transaction_id: transaction.transaction_id,
            refund_method: normalizedRefundMethod,
            refund_amount: cashRefundAmount,
            tax_breakdown
        });
    } catch (error) {
        await connection.rollback();
        console.error('Refund transaction error:', error);
        res.status(500).json({ error: 'Failed to refund transaction' });
    } finally {
        connection.release();
    }
};
