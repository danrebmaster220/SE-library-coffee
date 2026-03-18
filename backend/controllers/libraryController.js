const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { printLibraryCheckinReceipt, printLibraryExtensionReceipt } = require('../services/printerService');

// Pricing configuration
const LIBRARY_PRICING = {
    BASE_RATE: 100,      // ₱100 for first 2 hours
    BASE_MINUTES: 120,   // 2 hours = 120 minutes
    EXTEND_RATE: 50,     // ₱50 per 30 minutes extension
    EXTEND_MINUTES: 30   // Extension block size
};


// GET AVAILABLE SEATS FOR KIOSK (Public - no auth required)
// Excludes seats that are: maintenance, occupied (active session), or reserved by pending kiosk orders
exports.getAvailableSeatsPublic = async (req, res) => {
    try {
        // First, get all pending orders with library bookings to check reserved seats
        const [pendingOrders] = await db.query(`
            SELECT library_booking 
            FROM transactions 
            WHERE status = 'pending' 
            AND library_booking IS NOT NULL
        `);
        
        // Extract seat_ids from pending library bookings
        const reservedSeatIds = pendingOrders
            .map(order => {
                try {
                    const booking = typeof order.library_booking === 'string' 
                        ? JSON.parse(order.library_booking) 
                        : order.library_booking;
                    return booking?.seat_id;
                } catch (e) {
                    return null;
                }
            })
            .filter(id => id !== null);
        
        // Get all seats with their current status
        const [seats] = await db.query(`
            SELECT 
                s.seat_id,
                s.table_number,
                COALESCE(lt.table_name, CONCAT('Table ', s.table_number)) as table_name,
                s.seat_number,
                CASE 
                    WHEN s.status = 'maintenance' THEN 'maintenance'
                    WHEN ses.session_id IS NOT NULL THEN 'occupied'
                    ELSE s.status
                END as status
            FROM library_seats s
            LEFT JOIN library_tables lt ON s.table_number = lt.table_number
            LEFT JOIN library_sessions ses ON s.seat_id = ses.seat_id AND ses.status = 'active'
            WHERE s.status != 'maintenance'
            ORDER BY s.table_number, s.seat_number
        `);
        
        // Mark reserved seats
        const seatsWithReservations = seats.map(seat => ({
            ...seat,
            status: reservedSeatIds.includes(seat.seat_id) ? 'reserved' : seat.status
        }));
        
        res.json(seatsWithReservations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET ALL SEATS (with remaining time for occupied)

exports.getSeats = async (req, res) => {
    try {
        const lockedSeats = req.app.get('lockedSeats');
        
        // Check pending kiosk orders with library bookings for reserved seats
        const [pendingOrders] = await db.query(`
            SELECT library_booking 
            FROM transactions 
            WHERE status = 'pending' 
            AND library_booking IS NOT NULL
        `);
        
        // Extract seat_ids from pending library bookings
        const reservedSeatIds = pendingOrders
            .map(order => {
                try {
                    const booking = typeof order.library_booking === 'string' 
                        ? JSON.parse(order.library_booking) 
                        : order.library_booking;
                    return booking?.seat_id;
                } catch (_e) {
                    return null;
                }
            })
            .filter(id => id !== null);
        
        const [seats] = await db.query(`
            SELECT 
                s.seat_id,
                s.table_number,
                COALESCE(lt.table_name, CONCAT('Table ', s.table_number)) as table_name,
                s.seat_number,
                s.status,
                ses.session_id,
                ses.customer_name,
                ses.start_time,
                ses.paid_minutes,
                ses.amount_paid,
                TIMESTAMPDIFF(MINUTE, ses.start_time, NOW()) as elapsed_minutes,
                GREATEST(0, ses.paid_minutes - TIMESTAMPDIFF(MINUTE, ses.start_time, NOW())) as remaining_minutes
            FROM library_seats s
            LEFT JOIN library_tables lt ON s.table_number = lt.table_number
            LEFT JOIN library_sessions ses ON s.seat_id = ses.seat_id AND ses.status = 'active'
            ORDER BY s.table_number, s.seat_number
        `);
        
        // Mark seats with reservations from pending kiosk orders AND memory locks
        const seatsWithReservations = seats.map(seat => {
            // Check pending kiosk order reservations first
            if (reservedSeatIds.includes(seat.seat_id) && seat.status === 'available') {
                return { ...seat, status: 'reserved', kiosk_reserved: true };
            }
            // Then check in-memory locks
            const isLocked = lockedSeats && (
                lockedSeats.has(seat.seat_id) || 
                lockedSeats.has(String(seat.seat_id)) || 
                lockedSeats.has(Number(seat.seat_id))
            );
            if (isLocked && seat.status === 'available') {
                return { ...seat, status: 'reserved', temporary_lock: true };
            }
            return seat;
        });

        res.json(seatsWithReservations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CHECK-IN (Pay first, then start session)

exports.checkin = async (req, res) => {
    const { seat_id, customer_name, duration_minutes, amount_paid, cash_tendered } = req.body;
    
    // duration_minutes: how many minutes customer is paying for
    // amount_paid: total amount paid (calculated from duration)

    try {
        // Check if seat is available and get seat info
        const [seat] = await db.query('SELECT seat_id, table_number, seat_number, status FROM library_seats WHERE seat_id = ?', [seat_id]);
        
        if (seat.length === 0) {
            return res.status(404).json({ error: 'Seat not found' });
        }

        if (seat[0].status !== 'available') {
            return res.status(400).json({ error: 'Seat is not available' });
        }

        // Validate payment
        const calculatedAmount = calculateAmount(duration_minutes);
        if (amount_paid < calculatedAmount) {
            return res.status(400).json({ error: 'Insufficient payment' });
        }

        const actualCashTendered = cash_tendered || amount_paid;
        const changeDue = actualCashTendered - amount_paid;
        
        const userId = req.user?.user_id || req.user?.id || null;

        // Create session with paid time
        const [result] = await db.query(`
            INSERT INTO library_sessions 
            (seat_id, customer_name, paid_minutes, amount_paid, cash_tendered, change_due, status, start_time, processed_by) 
            VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), ?)
        `, [
            seat_id, 
            customer_name, 
            duration_minutes, 
            amount_paid,
            actualCashTendered,
            changeDue,
            userId
        ]);

        // Update seat status
        await db.query('UPDATE library_seats SET status = "occupied" WHERE seat_id = ?', [seat_id]);

        // Get cashier name from user token
        let cashierName = null;
        if (req.user?.user_id) {
            const [userInfo] = await db.query('SELECT full_name FROM users WHERE user_id = ?', [req.user.user_id]);
            if (userInfo.length > 0) {
                cashierName = userInfo[0].full_name;
            }
        }

        // Print check-in receipt
        try {
            await printLibraryCheckinReceipt({
                table_number: seat[0].table_number,
                seat_number: seat[0].seat_number,
                customer_name: customer_name,
                amount_paid: amount_paid,
                cash_tendered: actualCashTendered,
                change_due: changeDue,
                cashier_name: cashierName
            });
        } catch (printError) {
            console.log('Check-in receipt print failed:', printError.message);
            // Don't fail the check-in if printing fails
        }

        res.json({ 
            message: 'Check-in successful! Timer started.', 
            session_id: result.insertId,
            paid_minutes: duration_minutes,
            amount_paid: amount_paid,
            receipt_data: {
                session_id: result.insertId,
                table_number: seat[0].table_number,
                seat_number: seat[0].seat_number,
                customer_name: customer_name,
                paid_minutes: duration_minutes,
                duration_minutes: duration_minutes,
                amount_paid: amount_paid,
                cash_tendered: actualCashTendered,
                change_due: changeDue,
                cashier_name: cashierName
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper function to calculate amount based on duration
function calculateAmount(minutes) {
    if (minutes <= LIBRARY_PRICING.BASE_MINUTES) {
        return LIBRARY_PRICING.BASE_RATE;
    }
    
    const extraMinutes = minutes - LIBRARY_PRICING.BASE_MINUTES;
    const extraBlocks = Math.ceil(extraMinutes / LIBRARY_PRICING.EXTEND_MINUTES);
    return LIBRARY_PRICING.BASE_RATE + (extraBlocks * LIBRARY_PRICING.EXTEND_RATE);
}


// EXTEND SESSION (Pay more, add time)

exports.extend = async (req, res) => {
    const { session_id, minutes, amount_paid, cash_tendered } = req.body;

    try {
        // Get current session with seat info
        const [session] = await db.query(`
            SELECT s.*, ls.table_number, ls.seat_number,
                   GREATEST(0, s.paid_minutes - TIMESTAMPDIFF(MINUTE, s.start_time, NOW())) as remaining_minutes
            FROM library_sessions s
            JOIN library_seats ls ON s.seat_id = ls.seat_id
            WHERE s.session_id = ? AND s.status = 'active'
        `, [session_id]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Active session not found' });
        }

        // Calculate extension fee (₱50 per 30 minutes)
        const extensionFee = (minutes / LIBRARY_PRICING.EXTEND_MINUTES) * LIBRARY_PRICING.EXTEND_RATE;
        const actualAmountPaid = amount_paid || extensionFee;
        
        if (actualAmountPaid < extensionFee) {
            return res.status(400).json({ error: 'Insufficient payment for extension' });
        }

        // Update session with additional paid time
        const newPaidMinutes = parseInt(session[0].paid_minutes) + minutes;
        const newTotalPaid = parseFloat(session[0].amount_paid) + actualAmountPaid;
        const newRemainingMinutes = parseInt(session[0].remaining_minutes) + minutes;

        await db.query(`
            UPDATE library_sessions 
            SET paid_minutes = ?, amount_paid = ?
            WHERE session_id = ?
        `, [newPaidMinutes, newTotalPaid, session_id]);

        // Get cashier name from user token
        let cashierName = null;
        if (req.user?.user_id) {
            const [userInfo] = await db.query('SELECT full_name FROM users WHERE user_id = ?', [req.user.user_id]);
            if (userInfo.length > 0) {
                cashierName = userInfo[0].full_name;
            }
        }

        // Print extension receipt
        try {
            const actualCashTendered = cash_tendered || actualAmountPaid;
            await printLibraryExtensionReceipt({
                table_number: session[0].table_number,
                seat_number: session[0].seat_number,
                customer_name: session[0].customer_name,
                added_minutes: minutes,
                extension_fee: extensionFee,
                new_total_minutes: newPaidMinutes,
                remaining_minutes: newRemainingMinutes,
                cash_tendered: actualCashTendered,
                change_due: actualCashTendered - extensionFee,
                cashier_name: cashierName
            });
        } catch (printError) {
            console.log('Extension receipt print failed:', printError.message);
            // Don't fail the extension if printing fails
        }

        res.json({ 
            message: 'Time extended successfully!',
            added_minutes: minutes,
            new_total_minutes: newPaidMinutes,
            extension_fee: extensionFee,
            receipt_data: {
                session_id: session_id,
                table_number: session[0].table_number,
                seat_number: session[0].seat_number,
                customer_name: session[0].customer_name,
                added_minutes: minutes,
                extension_fee: extensionFee,
                new_total_minutes: newPaidMinutes,
                remaining_minutes: newRemainingMinutes,
                cash_tendered: cash_tendered || extensionFee,
                change_due: (cash_tendered || extensionFee) - extensionFee,
                cashier_name: cashierName
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CHECKOUT (End session, return ID - no payment needed)

exports.checkout = async (req, res) => {
    const { session_id } = req.body;

    try {
        // Get session
        const [session] = await db.query('SELECT * FROM library_sessions WHERE session_id = ? AND status = "active"', [session_id]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Active session not found' });
        }

        // Calculate actual time used
        const [result] = await db.query(`
            SELECT TIMESTAMPDIFF(MINUTE, start_time, NOW()) as total_minutes
            FROM library_sessions WHERE session_id = ?
        `, [session_id]);

        const totalMinutes = result[0].total_minutes;

        // Update session as completed
        await db.query(`
            UPDATE library_sessions 
            SET end_time = NOW(), 
                total_minutes = ?, 
                status = 'completed'
            WHERE session_id = ?
        `, [totalMinutes, session_id]);

        // Update seat status back to available
        await db.query('UPDATE library_seats SET status = "available" WHERE seat_id = ?', [session[0].seat_id]);

        res.json({ 
            message: 'Checkout successful! Please return customer ID.',
            total_minutes_used: totalMinutes,
            paid_minutes: session[0].paid_minutes,
            amount_paid: session[0].amount_paid
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET SESSION DETAILS

exports.getSession = async (req, res) => {
    const { id } = req.params;

    try {
        const [session] = await db.query(`
            SELECT 
                ses.*,
                s.table_number,
                s.seat_number,
                TIMESTAMPDIFF(MINUTE, ses.start_time, NOW()) as elapsed_minutes,
                GREATEST(0, ses.paid_minutes - TIMESTAMPDIFF(MINUTE, ses.start_time, NOW())) as remaining_minutes
            FROM library_sessions ses
            JOIN library_seats s ON ses.seat_id = s.seat_id
            WHERE ses.session_id = ?
        `, [id]);

        if (session.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        res.json(session[0]);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET LIBRARY CONFIGURATION

exports.getConfig = async (req, res) => {
    try {
        // Get table and seat counts with table names
        const [tables] = await db.query(`
            SELECT 
                ls.table_number, 
                COUNT(*) as seat_count,
                COALESCE(lt.table_name, CONCAT('Table ', ls.table_number)) as table_name
            FROM library_seats ls
            LEFT JOIN library_tables lt ON ls.table_number = lt.table_number
            GROUP BY ls.table_number, lt.table_name
            ORDER BY ls.table_number
        `);

        const [total] = await db.query('SELECT COUNT(*) as total FROM library_seats');

        res.json({
            total_seats: total[0].total,
            tables: tables.map(t => ({
                table_number: t.table_number,
                table_name: t.table_name,
                seats: t.seat_count
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// CONFIGURE LIBRARY (Set tables and seats)

exports.configure = async (req, res) => {
    const { tables, seats_per_table } = req.body;
    // tables: number of tables
    // seats_per_table: number of seats per table (same for all) OR array of seat counts per table

    if (!tables || tables < 1) {
        return res.status(400).json({ error: 'Number of tables must be at least 1' });
    }

    try {
        // Check if any active sessions exist
        const [activeSessions] = await db.query(
            'SELECT COUNT(*) as count FROM library_sessions WHERE status = "active"'
        );

        if (activeSessions[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot reconfigure while there are active sessions. Please checkout all sessions first.' 
            });
        }

        // Clear existing seats
        await db.query('DELETE FROM library_seats');

        // Generate new seats
        const seatsArray = Array.isArray(seats_per_table) ? seats_per_table : Array(tables).fill(seats_per_table || 8);
        
        const insertValues = [];
        for (let t = 1; t <= tables; t++) {
            const seatCount = seatsArray[t - 1] || 8;
            for (let s = 1; s <= seatCount; s++) {
                insertValues.push([t, s, 'available']);
            }
        }

        if (insertValues.length > 0) {
            await db.query(
                'INSERT INTO library_seats (table_number, seat_number, status) VALUES ?',
                [insertValues]
            );
        }

        res.json({ 
            message: 'Library configured successfully',
            total_tables: tables,
            total_seats: insertValues.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ADD TABLE (Dynamic)

exports.addTable = async (req, res) => {
    const { seats = 8, table_name } = req.body;

    try {
        // Get highest table number
        const [maxTable] = await db.query('SELECT MAX(table_number) as max FROM library_seats');
        const newTableNumber = (maxTable[0].max || 0) + 1;

        // Determine table name (use provided or generate default)
        const finalTableName = table_name && table_name.trim() !== '' 
            ? table_name.trim() 
            : `Table ${newTableNumber}`;

        // Insert into library_tables first
        await db.query(
            'INSERT INTO library_tables (table_number, table_name) VALUES (?, ?)',
            [newTableNumber, finalTableName]
        );

        // Insert new seats
        const insertValues = [];
        for (let s = 1; s <= seats; s++) {
            insertValues.push([newTableNumber, s, 'available']);
        }

        await db.query(
            'INSERT INTO library_seats (table_number, seat_number, status) VALUES ?',
            [insertValues]
        );

        res.json({ 
            message: 'Table added successfully',
            table_number: newTableNumber,
            table_name: finalTableName,
            seats: seats
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// REMOVE TABLE (Dynamic)

exports.removeTable = async (req, res) => {
    const { table_number } = req.params;

    try {
        // Check if any active sessions on this table
        const [activeSessions] = await db.query(`
            SELECT COUNT(*) as count 
            FROM library_sessions ses
            JOIN library_seats s ON ses.seat_id = s.seat_id
            WHERE s.table_number = ? AND ses.status = 'active'
        `, [table_number]);

        if (activeSessions[0].count > 0) {
            return res.status(400).json({ 
                error: 'Cannot remove table with active sessions. Please checkout all sessions first.' 
            });
        }

        // Delete seats for this table
        await db.query('DELETE FROM library_seats WHERE table_number = ?', [table_number]);

        // Also delete from library_tables
        await db.query('DELETE FROM library_tables WHERE table_number = ?', [table_number]);

        res.json({ 
            message: `Table ${table_number} removed successfully`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// UPDATE TABLE SEATS (Add/Remove seats from table)

exports.updateTableSeats = async (req, res) => {
    const { table_number } = req.params;
    const { seats } = req.body;

    if (!seats || seats < 1) {
        return res.status(400).json({ error: 'Number of seats must be at least 1' });
    }

    try {
        // Get current seat count for table
        const [currentSeats] = await db.query(
            'SELECT * FROM library_seats WHERE table_number = ? ORDER BY seat_number',
            [table_number]
        );

        if (currentSeats.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Check for active sessions
        const occupiedSeats = currentSeats.filter(s => s.status === 'occupied');
        if (seats < occupiedSeats.length) {
            return res.status(400).json({ 
                error: `Cannot reduce to ${seats} seats. There are ${occupiedSeats.length} occupied seats.` 
            });
        }

        if (seats > currentSeats.length) {
            // Add more seats
            const insertValues = [];
            for (let s = currentSeats.length + 1; s <= seats; s++) {
                insertValues.push([table_number, s, 'available']);
            }
            await db.query(
                'INSERT INTO library_seats (table_number, seat_number, status) VALUES ?',
                [insertValues]
            );
        } else if (seats < currentSeats.length) {
            // Remove seats (only available ones from the end)
            const seatsToRemove = currentSeats
                .filter(s => s.status === 'available' && s.seat_number > seats)
                .map(s => s.seat_id);
            
            if (seatsToRemove.length > 0) {
                await db.query(
                    'DELETE FROM library_seats WHERE seat_id IN (?)',
                    [seatsToRemove]
                );
            }
        }

        res.json({ 
            message: `Table ${table_number} updated to ${seats} seats`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// UPDATE TABLE NAME

exports.updateTableName = async (req, res) => {
    const { table_number } = req.params;
    const { table_name } = req.body;

    if (!table_name || table_name.trim() === '') {
        return res.status(400).json({ error: 'Table name is required' });
    }

    try {
        // Check if table exists in library_seats
        const [tableExists] = await db.query(
            'SELECT DISTINCT table_number FROM library_seats WHERE table_number = ?',
            [table_number]
        );

        if (tableExists.length === 0) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Upsert into library_tables
        await db.query(`
            INSERT INTO library_tables (table_number, table_name)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE table_name = VALUES(table_name)
        `, [table_number, table_name.trim()]);

        res.json({ 
            message: `Table name updated successfully`,
            table_number: parseInt(table_number),
            table_name: table_name.trim()
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// SET SEAT MAINTENANCE STATUS

exports.setMaintenance = async (req, res) => {
    const { seat_id } = req.params;
    const { maintenance } = req.body;

    try {
        // Check if seat exists and is not occupied
        const [seat] = await db.query('SELECT * FROM library_seats WHERE seat_id = ?', [seat_id]);
        
        if (seat.length === 0) {
            return res.status(404).json({ error: 'Seat not found' });
        }

        if (seat[0].status === 'occupied') {
            return res.status(400).json({ error: 'Cannot change status of occupied seat' });
        }

        const newStatus = maintenance ? 'maintenance' : 'available';
        await db.query('UPDATE library_seats SET status = ? WHERE seat_id = ?', [newStatus, seat_id]);

        res.json({ 
            message: `Seat ${seat_id} marked as ${newStatus}`,
            status: newStatus
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// GET SESSION HISTORY (completed and voided sessions)

exports.getSessionHistory = async (req, res) => {
    const { startDate, endDate, status } = req.query;
    
    try {
        let whereConditions = ["ses.status IN ('completed', 'voided')"];
        const params = [];

        if (startDate && endDate) {
            whereConditions.push('DATE(ses.start_time) BETWEEN ? AND ?');
            params.push(startDate, endDate);
        } else {
            // Default to last 7 days
            whereConditions.push('DATE(ses.start_time) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
        }

        if (status && status !== 'all') {
            whereConditions.push('ses.status = ?');
            params.push(status);
        }

        const [sessions] = await db.query(`
            SELECT 
                ses.session_id,
                ses.seat_id,
                s.table_number,
                COALESCE(lt.table_name, CONCAT('Table ', s.table_number)) as table_name,
                s.seat_number,
                ses.customer_name,
                ses.start_time,
                ses.end_time,
                ses.paid_minutes,
                ses.total_minutes,
                ses.amount_paid,
                ses.status,
                ses.voided_at,
                ses.voided_by,
                ses.void_reason,
                u.full_name as voided_by_name
            FROM library_sessions ses
            JOIN library_seats s ON ses.seat_id = s.seat_id
            LEFT JOIN library_tables lt ON s.table_number = lt.table_number
            LEFT JOIN users u ON ses.voided_by = u.user_id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ses.start_time DESC
            LIMIT 100
        `, params);

        res.json(sessions);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// VOID A LIBRARY SESSION
// - Admin can void directly (no extra auth needed)
// - Cashier needs admin credentials to void any session

exports.voidSession = async (req, res) => {
    const { session_id, reason, admin_credentials } = req.body;

    try {
        // Get session
        const [session] = await db.query(
            'SELECT * FROM library_sessions WHERE session_id = ?', 
            [session_id]
        );

        if (session.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        if (session[0].status === 'voided') {
            return res.status(400).json({ error: 'Session has already been voided' });
        }

        // Get user info and role
        const userId = req.user?.user_id || null;
        const userRole = req.user?.role?.toLowerCase() || null;
        let authorizedById = userId;

        // CASHIER AUTHORIZATION: Requires admin credentials
        if (userRole === 'cashier') {
            if (!admin_credentials || !admin_credentials.username || !admin_credentials.password) {
                return res.status(403).json({ 
                    error: 'Admin authorization required. Please provide admin credentials.' 
                });
            }

            // Verify admin credentials
            const [adminUser] = await db.query(
                'SELECT user_id, password_hash, role FROM users WHERE username = ?',
                [admin_credentials.username]
            );

            if (adminUser.length === 0) {
                return res.status(403).json({ error: 'Invalid admin credentials.' });
            }

            if (adminUser[0].role.toLowerCase() !== 'admin') {
                return res.status(403).json({ error: 'The provided credentials are not for an admin account.' });
            }

            const isValidPassword = await bcrypt.compare(admin_credentials.password, adminUser[0].password_hash);
            if (!isValidPassword) {
                return res.status(403).json({ error: 'Invalid admin password.' });
            }

            // Use the admin's ID as the authorizer
            authorizedById = adminUser[0].user_id;
        }

        // PERMISSION CHECK: Cashiers can only void ACTIVE sessions even with admin auth
        if (userRole === 'cashier' && session[0].status === 'completed') {
            return res.status(403).json({ 
                error: 'Cashiers cannot void completed sessions. Only active sessions can be voided.' 
            });
        }

        // If session is still active, free up the seat first
        if (session[0].status === 'active') {
            await db.query(
                'UPDATE library_seats SET status = "available" WHERE seat_id = ?', 
                [session[0].seat_id]
            );
        }

        // Update session as voided
        await db.query(`
            UPDATE library_sessions 
            SET status = 'voided',
                voided_at = NOW(),
                voided_by = ?,
                void_reason = ?,
                end_time = COALESCE(end_time, NOW())
            WHERE session_id = ?
        `, [authorizedById, reason || 'No reason provided', session_id]);

        // Get updated session with user name
        const [updatedSession] = await db.query(`
            SELECT ses.*, u.full_name as voided_by_name
            FROM library_sessions ses
            LEFT JOIN users u ON ses.voided_by = u.user_id
            WHERE ses.session_id = ?
        `, [session_id]);

        res.json({ 
            message: 'Session voided successfully',
            session: updatedSession[0],
            voided_amount: session[0].amount_paid
        });

    } catch (error) {
        console.error('Void session error:', error);
        res.status(500).json({ error: error.message });
    }
};
