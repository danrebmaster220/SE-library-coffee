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

        // Migration 6: Normalize legacy library schema to current API expectations
        await ensureLibrarySchemaCompatibility();

        // Migration 7: Add 'processed_by' column to library_sessions
        await addLibraryProcessedBy();

        // Migration 8: Backfill/index library_sessions.processed_by from transactions
        await backfillLibrarySessionsProcessedBy();

        // Migration 9: Fix library_sessions seat_id foreign key constraint
        await fixLibrarySessionsForeignKey();

        // Migration 10: Fix library_tables duplicate bug
        await fixLibraryTablesDuplicateBug();
        await fixLibrarySessionsGhostBug();

        // Migration 11: Create audit logs table for operational traces
        await createAuditLogsTable();

        // Migration 12: Backfill historical force-closed shifts into audit logs
        await backfillShiftForceClosedAuditLogs();

        // Migration 13: Clean technical backfill terms from audit details
        await sanitizeAuditBackfillDetails();

        // Migration 14: Add category-level hot/iced visibility flags
        await addCategoryTempVisibilityColumns();

        // Migration 15: Create item-level variant pricing table
        await createItemVariantPricingTable();

        // Migration 16: Users — split name + optional profile image (TiDB-safe: one ADD per column, no AFTER)
        await addUsersProfileColumns();

        // Migration 17: Add addon_limit column to categories (NULL = unlimited)
        await addCategoryAddonLimit();

        // Migration 18: Create effective-dated item price schedule table
        await createItemPriceSchedulesTable();

        // Migration 19: Seed default pricing schedule settings
        await ensurePriceScheduleSettings();

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

async function ensureLibrarySchemaCompatibility() {
    try {
        const tableExists = async (tableName) => {
            const [rows] = await db.query(
                `
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                `,
                [tableName]
            );
            return rows.length > 0;
        };

        const columnExists = async (tableName, columnName) => {
            const [rows] = await db.query(
                `
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = ?
                AND COLUMN_NAME = ?
                `,
                [tableName, columnName]
            );
            return rows.length > 0;
        };

        const [seatStatusCol] = await db.query(`
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'library_seats'
            AND COLUMN_NAME = 'status'
        `);

        if (seatStatusCol.length > 0 && !seatStatusCol[0].COLUMN_TYPE.includes('maintenance')) {
            await db.query(`
                ALTER TABLE library_seats
                MODIFY COLUMN status enum('available','occupied','maintenance') DEFAULT 'available'
            `);
            console.log('   ✅ Updated library_seats.status enum to include "maintenance"');
        }

        if (!(await tableExists('library_tables'))) {
            await db.query(`
                CREATE TABLE library_tables (
                    table_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    table_number INT NOT NULL,
                    table_name VARCHAR(100) DEFAULT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY table_number (table_number)
                )
            `);
            console.log('   ✅ Created "library_tables" table');
        } else {
            if (!(await columnExists('library_tables', 'table_name'))) {
                await db.query('ALTER TABLE library_tables ADD COLUMN table_name VARCHAR(100) DEFAULT NULL');
                console.log('   ✅ Added library_tables.table_name');
            }

            if (!(await columnExists('library_tables', 'created_at'))) {
                await db.query('ALTER TABLE library_tables ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
                console.log('   ✅ Added library_tables.created_at');
            }

            if (!(await columnExists('library_tables', 'updated_at'))) {
                await db.query('ALTER TABLE library_tables ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
                console.log('   ✅ Added library_tables.updated_at');
            }
        }

        if (await tableExists('library_seats')) {
            const [seedResult] = await db.query(`
                INSERT INTO library_tables (table_number, table_name)
                SELECT DISTINCT ls.table_number, CONCAT('Table ', ls.table_number)
                FROM library_seats ls
                LEFT JOIN library_tables lt ON lt.table_number = ls.table_number
                WHERE lt.table_number IS NULL
            `);

            const seeded = Number(seedResult?.affectedRows || 0);
            if (seeded > 0) {
                console.log(`   ✅ Seeded ${seeded} missing library table metadata row(s)`);
            }
        }

        if (!(await tableExists('library_sessions'))) {
            await db.query(`
                CREATE TABLE library_sessions (
                    session_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    seat_id INT DEFAULT NULL,
                    customer_name VARCHAR(100) DEFAULT NULL,
                    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    end_time DATETIME DEFAULT NULL,
                    total_minutes INT DEFAULT 0,
                    amount_due DECIMAL(10,2) DEFAULT 0.00,
                    status enum('active','completed','voided') DEFAULT 'active',
                    paid_minutes INT DEFAULT 0,
                    amount_paid DECIMAL(10,2) DEFAULT 0.00,
                    cash_tendered DECIMAL(10,2) DEFAULT NULL,
                    change_due DECIMAL(10,2) DEFAULT NULL,
                    voided_at DATETIME DEFAULT NULL,
                    voided_by INT DEFAULT NULL,
                    void_reason VARCHAR(255) DEFAULT NULL,
                    processed_by INT DEFAULT NULL
                )
            `);
            console.log('   ✅ Created "library_sessions" table with current columns');
            return;
        }

        const hasLegacyStartedAt = await columnExists('library_sessions', 'started_at');
        const hasLegacyCompletedAt = await columnExists('library_sessions', 'completed_at');
        const hasLegacyDuration = await columnExists('library_sessions', 'duration_minutes');
        const hasLegacyAmount = await columnExists('library_sessions', 'amount');

        if (!(await columnExists('library_sessions', 'start_time'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN start_time DATETIME DEFAULT CURRENT_TIMESTAMP');
            console.log('   ✅ Added library_sessions.start_time');
        }

        if (hasLegacyStartedAt) {
            await db.query(`
                UPDATE library_sessions
                SET start_time = started_at
                WHERE start_time IS NULL AND started_at IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'end_time'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN end_time DATETIME DEFAULT NULL');
            console.log('   ✅ Added library_sessions.end_time');
        }

        if (hasLegacyCompletedAt) {
            await db.query(`
                UPDATE library_sessions
                SET end_time = completed_at
                WHERE end_time IS NULL AND completed_at IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'total_minutes'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN total_minutes INT DEFAULT 0');
            console.log('   ✅ Added library_sessions.total_minutes');
        }

        if (hasLegacyDuration) {
            await db.query(`
                UPDATE library_sessions
                SET total_minutes = COALESCE(duration_minutes, 0)
                WHERE (total_minutes IS NULL OR total_minutes = 0)
                AND duration_minutes IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'amount_due'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN amount_due DECIMAL(10,2) DEFAULT 0.00');
            console.log('   ✅ Added library_sessions.amount_due');
        }

        if (hasLegacyAmount) {
            await db.query(`
                UPDATE library_sessions
                SET amount_due = COALESCE(amount, 0)
                WHERE (amount_due IS NULL OR amount_due = 0)
                AND amount IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'paid_minutes'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN paid_minutes INT DEFAULT 0');
            console.log('   ✅ Added library_sessions.paid_minutes');
        }

        if (hasLegacyDuration) {
            await db.query(`
                UPDATE library_sessions
                SET paid_minutes = COALESCE(duration_minutes, 0)
                WHERE (paid_minutes IS NULL OR paid_minutes = 0)
                AND duration_minutes IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'amount_paid'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0.00');
            console.log('   ✅ Added library_sessions.amount_paid');
        }

        if (hasLegacyAmount) {
            await db.query(`
                UPDATE library_sessions
                SET amount_paid = COALESCE(amount, 0)
                WHERE (amount_paid IS NULL OR amount_paid = 0)
                AND amount IS NOT NULL
            `);
        }

        if (!(await columnExists('library_sessions', 'cash_tendered'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN cash_tendered DECIMAL(10,2) DEFAULT NULL');
            console.log('   ✅ Added library_sessions.cash_tendered');
        }

        if (!(await columnExists('library_sessions', 'change_due'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN change_due DECIMAL(10,2) DEFAULT NULL');
            console.log('   ✅ Added library_sessions.change_due');
        }

        if (!(await columnExists('library_sessions', 'voided_at'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN voided_at DATETIME DEFAULT NULL');
            console.log('   ✅ Added library_sessions.voided_at');
        }

        if (!(await columnExists('library_sessions', 'voided_by'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN voided_by INT DEFAULT NULL');
            console.log('   ✅ Added library_sessions.voided_by');
        }

        if (!(await columnExists('library_sessions', 'void_reason'))) {
            await db.query('ALTER TABLE library_sessions ADD COLUMN void_reason VARCHAR(255) DEFAULT NULL');
            console.log('   ✅ Added library_sessions.void_reason');
        }

        console.log('   ✅ Library schema compatibility checks completed');
    } catch (error) {
        console.error('   ⚠️ ensureLibrarySchemaCompatibility:', error.message);
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

async function addCategoryTempVisibilityColumns() {
    try {
        const [hotCol] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'categories'
            AND COLUMN_NAME = 'allow_hot'
        `);

        if (hotCol.length === 0) {
            await db.query(`
                ALTER TABLE categories
                ADD COLUMN allow_hot TINYINT(1) NOT NULL DEFAULT 1
            `);
            console.log('   ✅ Added categories.allow_hot');
        } else {
            console.log('   ⏭️  categories.allow_hot already exists');
        }

        const [icedCol] = await db.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'categories'
            AND COLUMN_NAME = 'allow_iced'
        `);

        if (icedCol.length === 0) {
            await db.query(`
                ALTER TABLE categories
                ADD COLUMN allow_iced TINYINT(1) NOT NULL DEFAULT 1
            `);
            console.log('   ✅ Added categories.allow_iced');
        } else {
            console.log('   ⏭️  categories.allow_iced already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addCategoryTempVisibilityColumns:', error.message);
    }
}

async function createItemVariantPricingTable() {
    try {
        const [tables] = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'item_variant_prices'
        `);

        if (tables.length > 0) {
            console.log('   ⏭️  item_variant_prices table already exists');
            return;
        }

        await db.query(`
            CREATE TABLE item_variant_prices (
                variant_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                item_id INT NOT NULL,
                size_option_id INT NULL,
                temp_option_id INT NULL,
                price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                status ENUM('active','inactive') NOT NULL DEFAULT 'active',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_item_variant_combo (item_id, size_option_id, temp_option_id),
                INDEX idx_item_variant_item (item_id),
                INDEX idx_item_variant_size (size_option_id),
                INDEX idx_item_variant_temp (temp_option_id),
                CONSTRAINT fk_item_variant_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
                CONSTRAINT fk_item_variant_size FOREIGN KEY (size_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL,
                CONSTRAINT fk_item_variant_temp FOREIGN KEY (temp_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        console.log('   ✅ Created item_variant_prices table');
    } catch (error) {
        console.error('   ⚠️ createItemVariantPricingTable:', error.message);
    }
}

/**
 * Adds first_name, middle_name, last_name, profile_image to users.
 * Matches app expectations in userController / auth; idempotent for TiDB Cloud.
 * Uses INFORMATION_SCHEMA + DATABASE() like other migrations (same connection as the API).
 */
async function addUsersProfileColumns() {
    try {
        const columnExists = async (columnName) => {
            const [rows] = await db.query(
                `
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = ?
                `,
                [columnName]
            );
            return rows.length > 0;
        };

        if (!(await columnExists('first_name'))) {
            await db.query('ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL');
            console.log('   ✅ Added users.first_name');
        } else {
            console.log('   ⏭️  users.first_name already exists');
        }

        if (!(await columnExists('middle_name'))) {
            await db.query('ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NULL');
            console.log('   ✅ Added users.middle_name');
        } else {
            console.log('   ⏭️  users.middle_name already exists');
        }

        if (!(await columnExists('last_name'))) {
            await db.query('ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL');
            console.log('   ✅ Added users.last_name');
        } else {
            console.log('   ⏭️  users.last_name already exists');
        }

        if (!(await columnExists('profile_image'))) {
            await db.query('ALTER TABLE users ADD COLUMN profile_image LONGTEXT NULL');
            console.log('   ✅ Added users.profile_image');
        } else {
            console.log('   ⏭️  users.profile_image already exists');
        }

        const [backfillResult] = await db.query(`
            UPDATE users SET
              first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
              last_name = TRIM(
                CASE
                  WHEN full_name LIKE '% %' THEN SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2)
                  ELSE ''
                END
              )
            WHERE (first_name IS NULL OR TRIM(COALESCE(first_name, '')) = '')
              AND full_name IS NOT NULL AND TRIM(full_name) <> ''
        `);

        const backfilled = Number(backfillResult?.affectedRows || 0);
        if (backfilled > 0) {
            console.log(`   ✅ Backfilled users first/last name from full_name (${backfilled} row(s))`);
        } else {
            console.log('   ⏭️  No users rows needed name backfill');
        }

        const [syncResult] = await db.query(`
            UPDATE users SET
              full_name = TRIM(CONCAT_WS(
                ' ',
                NULLIF(TRIM(first_name), ''),
                NULLIF(TRIM(middle_name), ''),
                NULLIF(TRIM(last_name), '')
              ))
            WHERE TRIM(CONCAT_WS(
                ' ',
                COALESCE(first_name, ''),
                COALESCE(middle_name, ''),
                COALESCE(last_name, '')
            )) <> ''
        `);

        const synced = Number(syncResult?.affectedRows || 0);
        if (synced > 0) {
            console.log(`   ✅ Synced users.full_name from name parts (${synced} row(s))`);
        } else {
            console.log('   ⏭️  No users full_name sync needed');
        }
    } catch (error) {
        console.error('   ⚠️ addUsersProfileColumns:', error.message);
    }
}

async function addCategoryAddonLimit() {
    try {
        const [cols] = await db.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'categories'
            AND COLUMN_NAME = 'addon_limit'
        `);

        if (cols.length === 0) {
            await db.query(`
                ALTER TABLE categories
                ADD COLUMN addon_limit INT NULL DEFAULT NULL
            `);
            console.log('   ✅ Added categories.addon_limit');
        } else {
            console.log('   ⏭️  categories.addon_limit already exists');
        }
    } catch (error) {
        console.error('   ⚠️ addCategoryAddonLimit:', error.message);
    }
}

async function createItemPriceSchedulesTable() {
    try {
        const [tables] = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'item_price_schedules'
        `);

        if (tables.length > 0) {
            console.log('   ⏭️  item_price_schedules table already exists');
            return;
        }

        await db.query(`
            CREATE TABLE item_price_schedules (
                schedule_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                item_id INT NOT NULL,
                price_scope ENUM('base','variant') NOT NULL DEFAULT 'base',
                size_option_id INT NULL,
                temp_option_id INT NULL,
                current_price DECIMAL(10,2) NULL,
                scheduled_price DECIMAL(10,2) NOT NULL,
                status ENUM('pending','applied','cancelled','replaced','failed') NOT NULL DEFAULT 'pending',
                effective_at DATETIME NOT NULL,
                applied_at DATETIME NULL,
                cancelled_at DATETIME NULL,
                replaced_by_schedule_id BIGINT NULL,
                timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
                notes VARCHAR(255) NULL,
                created_by INT NULL,
                updated_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_price_sched_status_effective (status, effective_at),
                INDEX idx_price_sched_item_scope_status (item_id, price_scope, status, effective_at),
                INDEX idx_price_sched_variant_opts (size_option_id, temp_option_id),
                INDEX idx_price_sched_created_by (created_by),
                INDEX idx_price_sched_updated_by (updated_by),
                INDEX idx_price_sched_replaced_by (replaced_by_schedule_id),
                CONSTRAINT fk_price_sched_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
                CONSTRAINT fk_price_sched_size_opt FOREIGN KEY (size_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL,
                CONSTRAINT fk_price_sched_temp_opt FOREIGN KEY (temp_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL,
                CONSTRAINT fk_price_sched_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
                CONSTRAINT fk_price_sched_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
                CONSTRAINT fk_price_sched_replaced_by FOREIGN KEY (replaced_by_schedule_id) REFERENCES item_price_schedules(schedule_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);

        console.log('   ✅ Created item_price_schedules table');
    } catch (error) {
        console.error('   ⚠️ createItemPriceSchedulesTable:', error.message);
    }
}

async function ensurePriceScheduleSettings() {
    try {
        const [settingsTableRows] = await db.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'system_settings'
        `);

        if (settingsTableRows.length === 0) {
            await db.query(`
                CREATE TABLE system_settings (
                    setting_key VARCHAR(50) NOT NULL,
                    setting_value TEXT DEFAULT NULL,
                    PRIMARY KEY (setting_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            console.log('   ✅ Created system_settings table');
        }

        await db.query(`
            INSERT INTO system_settings (setting_key, setting_value)
            VALUES
                ('price_update_delay_days', '3'),
                ('price_update_timezone', 'Asia/Manila'),
                ('price_update_delay_options', '3,5,7')
            ON DUPLICATE KEY UPDATE setting_value = setting_value
        `);

        console.log('   ✅ Ensured pricing schedule default settings');
    } catch (error) {
        console.error('   ⚠️ ensurePriceScheduleSettings:', error.message);
    }
}

module.exports = runMigrations;
