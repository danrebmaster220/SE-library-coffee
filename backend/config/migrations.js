const db = require('./db');

/**
 * Database Migrations
 * Runs on server startup. Each migration checks if it's already applied
 * before executing, so it's safe to run multiple times (idempotent).
 */
async function runMigrations() {
    console.log('🔄 Running database migrations...');

    try {
        // Migration 1: Add 'refunded' to transactions.status enum
        await addRefundedStatus();

        // Migration 2: Add 'action_type' column to void_log
        await addVoidLogActionType();

        // Migration 3: Add 'refund_amount' column to void_log
        await addVoidLogRefundAmount();

        // Migration 4: Add 'unit_label' column to customization_groups
        await addUnitLabelColumn();

        // Migration 5: Create shifts table for cash management
        await createShiftsTable();

        // Migration 6: Add 'processed_by' column to library_sessions
        await addLibraryProcessedBy();

        // Migration 7: Backfill/index library_sessions.processed_by from transactions
        await backfillLibrarySessionsProcessedBy();

        // Migration 8: Fix library_sessions seat_id foreign key constraint
        await fixLibrarySessionsForeignKey();

        // Migration 9: Fix library_tables duplicate bug
        await fixLibraryTablesDuplicateBug();
        await fixLibrarySessionsGhostBug();

        // Migration 10: Create audit logs table for operational traces
        await createAuditLogsTable();

        // Migration 11: Backfill historical force-closed shifts into audit logs
        await backfillShiftForceClosedAuditLogs();

        // Migration 12: Clean technical backfill terms from audit details
        await sanitizeAuditBackfillDetails();

        console.log('✅ All database migrations completed successfully.');
    } catch (error) {
        console.error('⚠️ Migration error (non-fatal):', error.message);
        // Don't crash the server if migrations fail — existing features still work
    }
}

async function addRefundedStatus() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'transactions' 
            AND COLUMN_NAME = 'status'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (cols.length > 0 && !cols[0].COLUMN_TYPE.includes('refunded')) {
            await db.query(`
                ALTER TABLE transactions 
                MODIFY COLUMN status 
                enum('pending','preparing','ready','completed','voided','refunded') 
                NOT NULL DEFAULT 'pending'
            `);
            console.log('   ✅ Added "refunded" to transactions.status enum');
        } else {
            console.log('   ⏭️  transactions.status already has "refunded"');
        }
    } catch (error) {
        console.error('   ⚠️ addRefundedStatus:', error.message);
    }
}

async function addVoidLogActionType() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'void_log' 
            AND COLUMN_NAME = 'action_type'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE void_log 
                ADD COLUMN action_type enum('void','refund') NOT NULL DEFAULT 'void'
            `);
            console.log('   ✅ Added "action_type" column to void_log');
        } else {
            console.log('   ⏭️  void_log.action_type already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addVoidLogActionType:', error.message);
    }
}

async function addVoidLogRefundAmount() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'void_log' 
            AND COLUMN_NAME = 'refund_amount'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE void_log 
                ADD COLUMN refund_amount decimal(10,2) NULL
            `);
            console.log('   ✅ Added "refund_amount" column to void_log');
        } else {
            console.log('   ⏭️  void_log.refund_amount already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addVoidLogRefundAmount:', error.message);
    }
}

async function addUnitLabelColumn() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'customization_groups' 
            AND COLUMN_NAME = 'unit_label'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE customization_groups 
                ADD COLUMN unit_label VARCHAR(50) DEFAULT NULL
            `);
            console.log('   ✅ Added "unit_label" column to customization_groups');
        } else {
            console.log('   ⏭️  customization_groups.unit_label already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addUnitLabelColumn:', error.message);
    }
}

async function createShiftsTable() {
    try {
        const [tables] = await db.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'shifts' 
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (tables.length === 0) {
            await db.query(`
                CREATE TABLE shifts (
                    shift_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    end_time DATETIME DEFAULT NULL,
                    starting_cash DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    expected_cash DECIMAL(10,2) DEFAULT NULL,
                    actual_cash DECIMAL(10,2) DEFAULT NULL,
                    cash_difference DECIMAL(10,2) DEFAULT NULL,
                    total_sales DECIMAL(10,2) DEFAULT 0.00,
                    total_transactions INT DEFAULT 0,
                    total_voids INT DEFAULT 0,
                    total_refunds DECIMAL(10,2) DEFAULT 0.00,
                    status VARCHAR(10) NOT NULL DEFAULT 'active',
                    notes TEXT DEFAULT NULL,
                    closed_by INT DEFAULT NULL
                )
            `);
            console.log('   ✅ Created "shifts" table');
        } else {
            console.log('   ⏭️  shifts table already exists');
        }
    } catch (error) {
        console.error('   ⚠️ createShiftsTable:', error.message);
    }
}

async function addLibraryProcessedBy() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'library_sessions' 
            AND COLUMN_NAME = 'processed_by'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE library_sessions 
                ADD COLUMN processed_by INT DEFAULT NULL
            `);
            console.log('   ✅ Added "processed_by" column to library_sessions');
        } else {
            console.log('   ⏭️  library_sessions.processed_by already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addLibraryProcessedBy:', error.message);
    }
}

async function backfillLibrarySessionsProcessedBy() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'library_sessions'
            AND COLUMN_NAME = 'processed_by'
        `);

        if (cols.length === 0) {
            console.log('   ⏭️  Skipped library_sessions processed_by backfill (column missing)');
            return;
        }

        const [backfillResult] = await db.query(`
            UPDATE library_sessions ls
            JOIN (
                SELECT
                    t.library_session_id as session_id,
                    CAST(SUBSTRING_INDEX(
                        GROUP_CONCAT(t.processed_by ORDER BY t.created_at DESC SEPARATOR ','),
                        ',',
                        1
                    ) AS UNSIGNED) as processed_by
                FROM transactions t
                WHERE t.library_session_id IS NOT NULL
                AND t.processed_by IS NOT NULL
                GROUP BY t.library_session_id
            ) tx ON tx.session_id = ls.session_id
            SET ls.processed_by = tx.processed_by
            WHERE ls.processed_by IS NULL
        `);

        const updated = Number(backfillResult?.affectedRows || 0);
        if (updated > 0) {
            console.log(`   ✅ Backfilled processed_by for ${updated} library session(s)`);
        } else {
            console.log('   ⏭️  No library_sessions processed_by rows needed backfill');
        }

        const [indexRows] = await db.query(`
            SELECT COUNT(1) as count
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'library_sessions'
            AND INDEX_NAME = 'idx_library_sessions_processed_by'
        `);

        if (indexRows[0].count === 0) {
            await db.query('ALTER TABLE library_sessions ADD INDEX idx_library_sessions_processed_by (processed_by)');
            console.log('   ✅ Added idx_library_sessions_processed_by index');
        } else {
            console.log('   ⏭️  idx_library_sessions_processed_by already exists');
        }
    } catch (error) {
        console.error('   ⚠️ backfillLibrarySessionsProcessedBy:', error.message);
    }
}

async function fixLibrarySessionsForeignKey() {
    try {
        const [rows] = await db.query(`
            SELECT IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'library_sessions' 
            AND COLUMN_NAME = 'seat_id'
        `);
        
        if (rows.length > 0 && rows[0].IS_NULLABLE === 'NO') {
            await db.query('ALTER TABLE library_sessions MODIFY seat_id INT(11) NULL');
            try {
                await db.query('ALTER TABLE library_sessions DROP FOREIGN KEY library_sessions_ibfk_1');
            } catch (e) {
                // Ignore drop error if the name is different
            }
            await db.query('ALTER TABLE library_sessions ADD CONSTRAINT library_sessions_ibfk_1 FOREIGN KEY (seat_id) REFERENCES library_seats(seat_id) ON DELETE SET NULL');
            console.log('   ✅ Fixed library_sessions ON DELETE SET NULL constraint');
        } else {
            console.log('   ⏭️  library_sessions foreign key constraint already fixed');
        }
    } catch (error) {
        console.error('   ⚠️ fixLibrarySessionsForeignKey:', error.message);
    }
}

async function fixLibraryTablesDuplicateBug() {
    try {
        const [indexRows] = await db.query(`
            SELECT COUNT(1) as count 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'library_tables' 
            AND INDEX_NAME = 'table_number'
        `);

        if (indexRows.length > 0 && indexRows[0].count === 0) {
            // Delete duplicate rows, keeping only the one with the highest table_id (latest name)
            await db.query(`
                DELETE t1 FROM library_tables t1
                INNER JOIN library_tables t2 
                WHERE t1.table_id < t2.table_id 
                AND t1.table_number = t2.table_number
            `);
            
            // Add the unique constraint
            await db.query('ALTER TABLE library_tables ADD UNIQUE KEY `table_number` (`table_number`)');
            
            console.log('   ✅ Fixed library_tables duplicates and added UNIQUE constraint');
        } else {
            console.log('   ⏭️  library_tables unique constraint already exists');
        }
    } catch (error) {
        console.error('   ⚠️ fixLibraryTablesDuplicateBug:', error.message);
    }
}

async function fixLibrarySessionsGhostBug() {
    try {
        // Find and void ghost sessions (older active sessions for the same seat that has multiple active sessions)
        await db.query(`
            UPDATE library_sessions s1
            JOIN library_sessions s2 
              ON s1.seat_id = s2.seat_id 
              AND s1.status = 'active' 
              AND s2.status = 'active'
            SET s1.status = 'voided', 
                s1.void_reason = 'Auto-voided ghost session (duplicate check-in bug cleanup)',
                s1.end_time = NOW()
            WHERE s1.session_id < s2.session_id
        `);
        console.log('   ✅ Cleaned up ghost library sessions');
    } catch (error) {
        console.error('   ⚠️ fixLibrarySessionsGhostBug:', error.message);
    }
}

async function createAuditLogsTable() {
    try {
        const [tables] = await db.query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'audit_logs'
            AND TABLE_SCHEMA = DATABASE()
        `);

        if (tables.length > 0) {
            console.log('   ⏭️  audit_logs table already exists');
            return;
        }

        await db.query(`
            CREATE TABLE audit_logs (
                audit_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(80) NOT NULL,
                actor_user_id INT DEFAULT NULL,
                target_type VARCHAR(80) DEFAULT NULL,
                target_id INT DEFAULT NULL,
                details_json JSON DEFAULT NULL,
                ip_address VARCHAR(64) DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_action_created_at (action, created_at),
                INDEX idx_audit_actor_created_at (actor_user_id, created_at),
                INDEX idx_audit_target (target_type, target_id)
            )
        `);

        console.log('   ✅ Created "audit_logs" table');
    } catch (error) {
        console.error('   ⚠️ createAuditLogsTable:', error.message);
    }
}

async function backfillShiftForceClosedAuditLogs() {
    try {
        const [requiredTables] = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME IN ('audit_logs', 'shifts')
        `);

        if (requiredTables.length < 2) {
            console.log('   ⏭️  Skipped force-close audit backfill (required tables missing)');
            return;
        }

        const [result] = await db.query(`
            INSERT INTO audit_logs (
                action,
                actor_user_id,
                target_type,
                target_id,
                details_json,
                ip_address,
                created_at
            )
            SELECT
                'shift_force_closed' as action,
                s.closed_by as actor_user_id,
                'shift' as target_type,
                s.shift_id as target_id,
                JSON_OBJECT(
                    'target_user_id', s.user_id,
                    'expected_cash', s.expected_cash,
                    'notes', COALESCE(s.notes, 'Force-closed by admin (backfilled)')
                ) as details_json,
                NULL as ip_address,
                COALESCE(s.end_time, s.start_time, NOW()) as created_at
            FROM shifts s
            LEFT JOIN audit_logs a
                ON a.action = 'shift_force_closed'
                AND a.target_type = 'shift'
                AND a.target_id = s.shift_id
            WHERE s.status = 'closed'
            AND a.audit_id IS NULL
            AND s.actual_cash IS NULL
            AND s.cash_difference IS NULL
            AND (
                (s.closed_by IS NOT NULL AND s.closed_by <> s.user_id)
                OR LOWER(COALESCE(s.notes, '')) LIKE '%force-closed%'
                OR LOWER(COALESCE(s.notes, '')) LIKE '%force closed%'
                OR LOWER(COALESCE(s.notes, '')) LIKE '%forceclose%'
            )
        `);

        const inserted = Number(result?.affectedRows || 0);
        if (inserted > 0) {
            console.log(`   ✅ Backfilled ${inserted} historical shift force-close audit log(s)`);
        } else {
            console.log('   ⏭️  No historical force-close audit logs to backfill');
        }
    } catch (error) {
        console.error('   ⚠️ backfillShiftForceClosedAuditLogs:', error.message);
    }
}

async function sanitizeAuditBackfillDetails() {
    try {
        const [tables] = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'audit_logs'
        `);

        if (tables.length === 0) {
            console.log('   ⏭️  Skipped audit detail cleanup (audit_logs missing)');
            return;
        }

        // Remove technical wording from legacy backfilled notes.
        const [notesResult] = await db.query(`
            UPDATE audit_logs
            SET details_json = JSON_SET(
                details_json,
                '$.notes',
                TRIM(REPLACE(JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.notes')), '(backfilled)', ''))
            )
            WHERE action = 'shift_force_closed'
            AND JSON_EXTRACT(details_json, '$.notes') IS NOT NULL
            AND JSON_UNQUOTE(JSON_EXTRACT(details_json, '$.notes')) LIKE '%(backfilled)%'
        `);

        // Remove legacy technical marker key from older rows.
        const [flagResult] = await db.query(`
            UPDATE audit_logs
            SET details_json = JSON_REMOVE(details_json, '$.backfilled')
            WHERE action = 'shift_force_closed'
            AND JSON_EXTRACT(details_json, '$.backfilled') IS NOT NULL
        `);

        const notesCleaned = Number(notesResult?.affectedRows || 0);
        const flagsRemoved = Number(flagResult?.affectedRows || 0);

        if (notesCleaned > 0 || flagsRemoved > 0) {
            console.log(`   ✅ Cleaned audit details (notes: ${notesCleaned}, flags: ${flagsRemoved})`);
        } else {
            console.log('   ⏭️  No audit detail cleanup needed');
        }
    } catch (error) {
        console.error('   ⚠️ sanitizeAuditBackfillDetails:', error.message);
    }
}

module.exports = runMigrations;
