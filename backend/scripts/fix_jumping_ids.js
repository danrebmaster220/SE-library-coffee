const db = require('../config/db.js');

async function run() {
    console.log("🛠️ Starting ID Resequencing Script for TiDB...");

    let connection;
    try {
        connection = await db.getConnection();
        console.log("✅ Connected to Database via Pool.");
        
        // Disable Foreign Key Checks temporarily
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log("🔓 Disabled Foreign Key Checks.");

        const tableMaps = [
            {
                table: 'categories',
                idCol: 'category_id',
                jumpThreshold: 1000,
                children: [{ table: 'items', fk: 'category_id' }]
            },
            {
                table: 'discounts',
                idCol: 'discount_id',
                jumpThreshold: 1000,
                children: [
                    { table: 'orders', fk: 'discount_id' },
                    { table: 'transactions', fk: 'discount_id' }
                ]
            },
            {
                table: 'users',
                idCol: 'user_id',
                jumpThreshold: 1000,
                children: [
                    { table: 'transactions', fk: 'processed_by' },
                    { table: 'transactions', fk: 'voided_by' },
                    { table: 'library_sessions', fk: 'voided_by' },
                    { table: 'void_log', fk: 'voided_by' }
                ]
            },
            {
                table: 'items',
                idCol: 'item_id',
                jumpThreshold: 1000,
                children: [
                    { table: 'order_items', fk: 'item_id' },
                    { table: 'transaction_items', fk: 'item_id' },
                    { table: 'item_customization_groups', fk: 'item_id' }
                ]
            },
            {
                table: 'audit_logs',
                idCol: 'audit_id',
                jumpThreshold: 30000,
                children: []
            }
        ];

        for (const meta of tableMaps) {
            console.log(`\n🔍 Checking table: ${meta.table}`);
            const [tableExists] = await connection.query(
                `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                [meta.table]
            );

            if (tableExists.length === 0) {
                console.log(`  ⏭️  Skipping ${meta.table} (table does not exist).`);
                continue;
            }

            const threshold = meta.jumpThreshold || 1000;
            const [rows] = await connection.query(
                `SELECT ${meta.idCol} FROM ${meta.table} WHERE ${meta.idCol} >= ? ORDER BY ${meta.idCol} ASC`,
                [threshold]
            );
            
            if (rows.length === 0) {
                console.log(`  ✓ No jumping IDs found in ${meta.table}.`);
                continue;
            }

            console.log(`  ⚠️ Found ${rows.length} jumping IDs in ${meta.table}. Fixing...`);

            // Get current max valid ID
            const [maxRows] = await connection.query(
                `SELECT MAX(${meta.idCol}) as maxId FROM ${meta.table} WHERE ${meta.idCol} < ?`,
                [threshold]
            );
            let nextValidId = (maxRows[0].maxId || 0) + 1;

            for (const row of rows) {
                const oldId = row[meta.idCol];
                const newId = nextValidId++;
                
                // Update parent row
                await connection.query(`UPDATE ${meta.table} SET ${meta.idCol} = ? WHERE ${meta.idCol} = ?`, [newId, oldId]);
                console.log(`    → Reassigned ID ${oldId} to ${newId} in ${meta.table}`);

                // Update children foreign keys
                for (const child of meta.children) {
                    const [updateInfo] = await connection.query(`UPDATE ${child.table} SET ${child.fk} = ? WHERE ${child.fk} = ?`, [newId, oldId]);
                    if (updateInfo.affectedRows > 0) {
                        console.log(`      ↳ Updated ${updateInfo.affectedRows} references in ${child.table}`);
                    }
                }
            }
        }

        const [auditTableExists] = await connection.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs'`
        );

        if (auditTableExists.length > 0) {
            const [auditMaxRows] = await connection.query('SELECT MAX(audit_id) AS maxId FROM audit_logs');
            const nextAuditId = Number(auditMaxRows[0].maxId || 0) + 1;

            await connection.query(`ALTER TABLE audit_logs AUTO_INCREMENT = ${nextAuditId}`);
            console.log(`\n🔢 Set audit_logs AUTO_INCREMENT to ${nextAuditId}.`);

            const [versionRows] = await connection.query('SELECT VERSION() AS version');
            const dbVersion = String(versionRows?.[0]?.version || '');

            if (dbVersion.toLowerCase().includes('tidb')) {
                try {
                    await connection.query('ALTER TABLE audit_logs AUTO_ID_CACHE = 1');
                    console.log('🧩 Set audit_logs AUTO_ID_CACHE=1 for TiDB to minimize future ID jumps.');
                } catch (cacheError) {
                    console.log(`⚠️ Could not set AUTO_ID_CACHE for audit_logs: ${cacheError.message}`);
                }
            }
        }

        // Re-enable Foreign Key Checks
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log("\n🔒 Re-enabled Foreign Key Checks.");

        console.log("🎉 ID Resequencing Complete!");
        
    } catch (err) {
        console.error("❌ Error running script:", err.message);
        if (err.sqlMessage) console.error("SQL Message:", err.sqlMessage);
        if (err.sql) console.error("Failing Query:", err.sql);
        
        if (connection) {
            try {
                await connection.query('SET FOREIGN_KEY_CHECKS = 1');
                console.log("🔒 Re-enabled Foreign Key Checks after error.");
            } catch(e) {}
        }
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = run;
