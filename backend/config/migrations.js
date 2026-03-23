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

        // Migration 7: Fix library_sessions seat_id foreign key constraint
        await fixLibrarySessionsForeignKey();

        console.log('✅ Database migrations complete.');
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

module.exports = runMigrations;
