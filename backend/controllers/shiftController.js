const db = require('../config/db');
const { logAuditEvent } = require('../services/auditLogService');

const SHIFT_SOCKET_ROOM = 'authenticated-users';
const MAX_SHIFT_NOTES_LENGTH = 500;

const normalizeMoneyInput = (value, { allowEmptyAsZero = false } = {}) => {
    if (value === null || value === undefined || value === '') {
        return allowEmptyAsZero ? 0 : null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

const normalizeNotes = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    return text.slice(0, MAX_SHIFT_NOTES_LENGTH);
};

const emitShiftUpdated = (req, payload = {}) => {
    const io = req.app?.get('io');
    if (!io) return;

    io.to(SHIFT_SOCKET_ROOM).emit('shift:updated', {
        timestamp: new Date().toISOString(),
        ...payload
    });
};

const getRequestIpAddress = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || null;
};

const logShiftAudit = async (req, {
    action,
    actorUserId,
    shiftId,
    targetUserId,
    details
}) => {
    try {
        await logAuditEvent({
            action,
            actorUserId,
            targetType: 'shift',
            targetId: shiftId,
            ipAddress: getRequestIpAddress(req),
            details: {
                target_user_id: targetUserId,
                ...details
            }
        });
    } catch (error) {
        console.warn('shift audit log skipped:', error.message);
    }
};

// Start a new shift for the logged-in user
exports.startShift = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        const { starting_cash } = req.body;
        const startingCashValue = normalizeMoneyInput(starting_cash, { allowEmptyAsZero: true });

        if (startingCashValue === null) {
            return res.status(400).json({ error: 'Starting cash must be a valid non-negative amount.' });
        }

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
            [userId, startingCashValue, 'active']
        );

        const [newShift] = await db.query(
            'SELECT * FROM shifts WHERE shift_id = ?',
            [result.insertId]
        );

        emitShiftUpdated(req, {
            action: 'started',
            shift_id: newShift[0]?.shift_id,
            user_id: userId,
            status: 'active'
        });

        await logShiftAudit(req, {
            action: 'shift_started',
            actorUserId: userId,
            shiftId: newShift[0]?.shift_id || null,
            targetUserId: userId,
            details: {
                starting_cash: startingCashValue
            }
        });

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
    let connection;
    try {
        const userId = req.user?.user_id || req.user?.id;
        const { actual_cash, notes } = req.body;
        const actualCash = normalizeMoneyInput(actual_cash);
        const normalizedNotes = normalizeNotes(notes);

        if (actualCash === null) {
            return res.status(400).json({ error: 'Actual cash must be provided as a valid non-negative amount.' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // Lock active shift row to prevent double-close races.
        const [shifts] = await connection.query(
            'SELECT * FROM shifts WHERE user_id = ? AND status = ? FOR UPDATE',
            [userId, 'active']
        );

        if (shifts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'No active shift found' });
        }

        const shift = shifts[0];
        const closeTime = new Date();
        const summary = await getShiftSummary({ ...shift, end_time: closeTime }, connection);

        // Calculate expected cash = starting cash + cash sales - cash refunds
        const expectedCash = parseFloat(shift.starting_cash) + parseFloat(summary.total_sales) - parseFloat(summary.total_refunds);
        const cashDifference = actualCash - expectedCash;

        // Update the shift
        await connection.query(`
            UPDATE shifts SET
                end_time = ?,
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
            WHERE shift_id = ? AND status = 'active'
        `, [
            closeTime,
            expectedCash,
            actualCash,
            cashDifference,
            summary.total_sales,
            summary.total_transactions,
            summary.total_voids,
            summary.total_refunds,
            normalizedNotes,
            userId,
            shift.shift_id
        ]);

        await connection.commit();

        // Get the updated shift
        const [updatedShift] = await db.query(
            'SELECT s.*, u.full_name FROM shifts s JOIN users u ON s.user_id = u.user_id WHERE s.shift_id = ?',
            [shift.shift_id]
        );

        emitShiftUpdated(req, {
            action: 'ended',
            shift_id: shift.shift_id,
            user_id: shift.user_id,
            closed_by: userId,
            status: 'closed'
        });

        await logShiftAudit(req, {
            action: 'shift_ended',
            actorUserId: userId,
            shiftId: shift.shift_id,
            targetUserId: shift.user_id,
            details: {
                expected_cash: expectedCash,
                actual_cash: actualCash,
                cash_difference: cashDifference,
                notes: normalizedNotes
            }
        });

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
        if (connection) {
            try {
                await connection.rollback();
            } catch (_rollbackError) {
                // No-op: prefer returning original error context.
            }
        }
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
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
                   cb.full_name as closed_by_name,
                   CASE
                       WHEN s.actual_cash IS NULL
                            AND s.cash_difference IS NULL
                            AND (
                                (s.closed_by IS NOT NULL AND s.closed_by <> s.user_id)
                                OR LOWER(COALESCE(s.notes, '')) LIKE '%force-closed%'
                                OR LOWER(COALESCE(s.notes, '')) LIKE '%force closed%'
                                OR LOWER(COALESCE(s.notes, '')) LIKE '%forceclose%'
                            )
                       THEN 1
                       ELSE 0
                   END AS is_force_closed
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
    let connection;
    try {
        const adminId = req.user?.user_id || req.user?.id;
        const { id } = req.params;
        const { notes } = req.body;
        const normalizedNotes = normalizeNotes(notes);

        if (!normalizedNotes) {
            return res.status(400).json({ error: 'Reason is required when force-closing a shift.' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [shifts] = await connection.query(
            'SELECT * FROM shifts WHERE shift_id = ? AND status = ? FOR UPDATE',
            [id, 'active']
        );

        if (shifts.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Active shift not found' });
        }

        const shift = shifts[0];
        const closeTime = new Date();
        const summary = await getShiftSummary({ ...shift, end_time: closeTime }, connection);
        const expectedCash = parseFloat(shift.starting_cash) + parseFloat(summary.total_sales) - parseFloat(summary.total_refunds);

        await connection.query(`
            UPDATE shifts SET
                end_time = ?,
                expected_cash = ?,
                total_sales = ?,
                total_transactions = ?,
                total_voids = ?,
                total_refunds = ?,
                status = 'closed',
                notes = ?,
                closed_by = ?
            WHERE shift_id = ? AND status = 'active'
        `, [
            closeTime,
            expectedCash,
            summary.total_sales,
            summary.total_transactions,
            summary.total_voids,
            summary.total_refunds,
            normalizedNotes,
            adminId,
            id
        ]);

        await connection.commit();

        emitShiftUpdated(req, {
            action: 'force_closed',
            shift_id: Number(id),
            user_id: shift.user_id,
            closed_by: adminId,
            status: 'closed'
        });

        await logShiftAudit(req, {
            action: 'shift_force_closed',
            actorUserId: adminId,
            shiftId: Number(id),
            targetUserId: shift.user_id,
            details: {
                expected_cash: expectedCash,
                notes: normalizedNotes
            }
        });

        res.json({ success: true, message: 'Shift force-closed successfully' });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (_rollbackError) {
                // No-op: prefer returning original error context.
            }
        }
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// Helper: Calculate shift summary from completed transactions
async function getShiftSummary(shift, queryExecutor = db) {
    try {
        // Total completed sales during this shift by this cashier
        const [salesResult] = await queryExecutor.query(`
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_sales,
                COUNT(*) as total_transactions
            FROM transactions 
            WHERE processed_by = ? 
            AND status IN ('completed', 'preparing', 'ready', 'refunded')
            AND created_at >= ?
            ${shift.end_time ? 'AND created_at <= ?' : ''}
        `, shift.end_time 
            ? [shift.user_id, shift.start_time, shift.end_time]
            : [shift.user_id, shift.start_time]
        );

        // Total library sales during this shift
        const [librarySalesResult] = await queryExecutor.query(`
            SELECT 
                COALESCE(SUM(amount_paid), 0) as library_sales
            FROM library_sessions
            WHERE processed_by = ? 
            AND status IN ('active', 'completed')
            AND start_time >= ?
            ${shift.end_time ? 'AND start_time <= ?' : ''}
        `, shift.end_time
            ? [shift.user_id, shift.start_time, shift.end_time]
            : [shift.user_id, shift.start_time]
        );

        // Total voids during this shift
        const [voidResult] = await queryExecutor.query(`
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

        // Total cash refunds during this shift.
        // Use void_log refund metadata when available; fall back to legacy refunded transaction totals.
        let totalRefunds = 0;
        try {
            const [refundRows] = await queryExecutor.query(`
                SELECT 
                    COALESCE(
                        SUM(
                            CASE
                                WHEN vl.action_type = 'refund' THEN COALESCE(vl.refund_amount, vl.original_amount, 0)
                                WHEN vl.action_type IS NULL AND t.status = 'refunded' THEN COALESCE(vl.original_amount, 0)
                                ELSE 0
                            END
                        ),
                        0
                    ) as total_refunds
                FROM void_log vl
                JOIN transactions t ON t.transaction_id = vl.transaction_id
                WHERE t.processed_by = ?
                AND vl.voided_at >= ?
                ${shift.end_time ? 'AND vl.voided_at <= ?' : ''}
            `, shift.end_time
                ? [shift.user_id, shift.start_time, shift.end_time]
                : [shift.user_id, shift.start_time]
            );

            totalRefunds = parseFloat(refundRows?.[0]?.total_refunds) || 0;
        } catch (_refundLogError) {
            const [fallbackRefundRows] = await queryExecutor.query(`
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

            totalRefunds = parseFloat(fallbackRefundRows?.[0]?.total_refunds) || 0;
        }

        return {
            running_sales: (parseFloat(salesResult[0].total_sales) || 0) + (parseFloat(librarySalesResult[0].library_sales) || 0),
            total_sales: (parseFloat(salesResult[0].total_sales) || 0) + (parseFloat(librarySalesResult[0].library_sales) || 0),
            total_transactions: parseInt(salesResult[0].total_transactions) || 0,
            total_voids: parseInt(voidResult[0].total_voids) || 0,
            total_refunds: totalRefunds
        };
    } catch (error) {
        console.error('getShiftSummary error:', error.message);
        return { running_sales: 0, total_sales: 0, total_transactions: 0, total_voids: 0, total_refunds: 0 };
    }
}
