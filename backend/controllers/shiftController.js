const db = require('../config/db');

// Start a new shift for the logged-in user
exports.startShift = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const { starting_cash } = req.body;

        // Check if user already has an active shift
        const [existing] = await db.query(
            'SELECT shift_id FROM shifts WHERE user_id = ? AND status = ?',
            [userId, 'active']
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                error: 'You already have an active shift',
                shift_id: existing[0].shift_id
            });
        }

        const [result] = await db.query(
            'INSERT INTO shifts (user_id, starting_cash, start_time, status) VALUES (?, ?, NOW(), ?)',
            [userId, parseFloat(starting_cash) || 0, 'active']
        );

        const [newShift] = await db.query(
            'SELECT * FROM shifts WHERE shift_id = ?',
            [result.insertId]
        );

        res.json({ success: true, shift: newShift[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get current user's active shift
exports.getMyActiveShift = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;

        const [shifts] = await db.query(
            'SELECT s.*, u.full_name FROM shifts s JOIN users u ON s.user_id = u.user_id WHERE s.user_id = ? AND s.status = ? LIMIT 1',
            [userId, 'active']
        );

        if (shifts.length === 0) {
            return res.json({ shift: null });
        }

        // Get running totals for this shift period
        const shift = shifts[0];
        const summary = await getShiftSummary(shift);

        res.json({ 
            shift: {
                ...shift,
                ...summary
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// End the current user's active shift
exports.endShift = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const { actual_cash, notes } = req.body;

        // Get the active shift
        const [shifts] = await db.query(
            'SELECT * FROM shifts WHERE user_id = ? AND status = ?',
            [userId, 'active']
        );

        if (shifts.length === 0) {
            return res.status(404).json({ error: 'No active shift found' });
        }

        const shift = shifts[0];
        const summary = await getShiftSummary(shift);

        // Calculate expected cash = starting cash + cash sales - cash refunds
        const expectedCash = parseFloat(shift.starting_cash) + parseFloat(summary.total_sales) - parseFloat(summary.total_refunds);
        const actualCash = parseFloat(actual_cash) || 0;
        const cashDifference = actualCash - expectedCash;

        // Update the shift
        await db.query(`
            UPDATE shifts SET
                end_time = NOW(),
                expected_cash = ?,
                actual_cash = ?,
                cash_difference = ?,
                total_sales = ?,
                total_transactions = ?,
                total_voids = ?,
                total_refunds = ?,
                status = 'closed',
                notes = ?,
                closed_by = ?
            WHERE shift_id = ?
        `, [
            expectedCash,
            actualCash,
            cashDifference,
            summary.total_sales,
            summary.total_transactions,
            summary.total_voids,
            summary.total_refunds,
            notes || null,
            userId,
            shift.shift_id
        ]);

        // Get the updated shift
        const [updatedShift] = await db.query(
            'SELECT s.*, u.full_name FROM shifts s JOIN users u ON s.user_id = u.user_id WHERE s.shift_id = ?',
            [shift.shift_id]
        );

        res.json({ 
            success: true, 
            shift: updatedShift[0],
            summary: {
                expected_cash: expectedCash,
                actual_cash: actualCash,
                cash_difference: cashDifference,
                status: cashDifference === 0 ? 'exact' : cashDifference > 0 ? 'overage' : 'shortage'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Get all active shifts
exports.getAllActiveShifts = async (req, res) => {
    try {
        const [shifts] = await db.query(`
            SELECT s.*, u.full_name, u.username
            FROM shifts s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.status = 'active'
            ORDER BY s.start_time ASC
        `);

        // Get running totals for each active shift
        for (let shift of shifts) {
            const summary = await getShiftSummary(shift);
            Object.assign(shift, summary);
        }

        res.json({ shifts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Get shift history (closed shifts)
exports.getShiftHistory = async (req, res) => {
    try {
        const { start_date, end_date, user_id } = req.query;
        
        let query = `
            SELECT s.*, u.full_name, u.username,
                   cb.full_name as closed_by_name
            FROM shifts s
            JOIN users u ON s.user_id = u.user_id
            LEFT JOIN users cb ON s.closed_by = cb.user_id
            WHERE s.status = 'closed'
        `;
        const params = [];

        if (start_date) {
            query += ' AND s.start_time >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND s.end_time <= ?';
            params.push(end_date + ' 23:59:59');
        }
        if (user_id) {
            query += ' AND s.user_id = ?';
            params.push(user_id);
        }

        query += ' ORDER BY s.end_time DESC LIMIT 100';

        const [shifts] = await db.query(query, params);

        res.json({ shifts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Admin: Force close an orphaned shift
exports.forceCloseShift = async (req, res) => {
    try {
        const adminId = req.user?.user_id || req.user?.id;
        const { id } = req.params;
        const { notes } = req.body;

        const [shifts] = await db.query(
            'SELECT * FROM shifts WHERE shift_id = ? AND status = ?',
            [id, 'active']
        );

        if (shifts.length === 0) {
            return res.status(404).json({ error: 'Active shift not found' });
        }

        const shift = shifts[0];
        const summary = await getShiftSummary(shift);
        const expectedCash = parseFloat(shift.starting_cash) + parseFloat(summary.total_sales) - parseFloat(summary.total_refunds);

        await db.query(`
            UPDATE shifts SET
                end_time = NOW(),
                expected_cash = ?,
                total_sales = ?,
                total_transactions = ?,
                total_voids = ?,
                total_refunds = ?,
                status = 'closed',
                notes = ?,
                closed_by = ?
            WHERE shift_id = ?
        `, [
            expectedCash,
            summary.total_sales,
            summary.total_transactions,
            summary.total_voids,
            summary.total_refunds,
            notes || 'Force-closed by admin',
            adminId,
            id
        ]);

        res.json({ success: true, message: 'Shift force-closed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper: Calculate shift summary from completed transactions
async function getShiftSummary(shift) {
    try {
        // Total completed sales during this shift by this cashier
        const [salesResult] = await db.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as total_transactions
            FROM transactions 
            WHERE processed_by = ? 
            AND status IN ('completed', 'preparing', 'ready')
            AND created_at >= ?
            ${shift.end_time ? 'AND created_at <= ?' : ''}
        `, shift.end_time 
            ? [shift.user_id, shift.start_time, shift.end_time]
            : [shift.user_id, shift.start_time]
        );

        // Total voids during this shift
        const [voidResult] = await db.query(`
            SELECT COUNT(*) as total_voids
            FROM transactions 
            WHERE processed_by = ? 
            AND status = 'voided'
            AND created_at >= ?
            ${shift.end_time ? 'AND created_at <= ?' : ''}
        `, shift.end_time
            ? [shift.user_id, shift.start_time, shift.end_time]
            : [shift.user_id, shift.start_time]
        );

        // Total refunds during this shift
        const [refundResult] = await db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as total_refunds
            FROM transactions 
            WHERE processed_by = ? 
            AND status = 'refunded'
            AND created_at >= ?
            ${shift.end_time ? 'AND created_at <= ?' : ''}
        `, shift.end_time
            ? [shift.user_id, shift.start_time, shift.end_time]
            : [shift.user_id, shift.start_time]
        );

        return {
            running_sales: parseFloat(salesResult[0].total_sales) || 0,
            total_sales: parseFloat(salesResult[0].total_sales) || 0,
            total_transactions: parseInt(salesResult[0].total_transactions) || 0,
            total_voids: parseInt(voidResult[0].total_voids) || 0,
            total_refunds: parseFloat(refundResult[0].total_refunds) || 0
        };
    } catch (error) {
        console.error('getShiftSummary error:', error.message);
        return { running_sales: 0, total_sales: 0, total_transactions: 0, total_voids: 0, total_refunds: 0 };
    }
}
