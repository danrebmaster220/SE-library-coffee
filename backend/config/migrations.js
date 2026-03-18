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

module.exports = runMigrations;
