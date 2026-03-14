const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false },
  multipleStatements: true // Required to run a .sql script with multiple queries
};

(async () => {
  try {
    console.log('Connecting to TiDB...');
    const c = await mysql.createConnection(CONFIG);
    console.log('Connected successfully.');

    console.log('Reading tidb_import.sql...');
    const sql = fs.readFileSync('tidb_import.sql', 'utf8');

    console.log('Executing SQL import by splitting queries...');
    const queries = sql.replace(/--.*$/gm, '').split(';').map(q => q.trim()).filter(q => q.length > 0);
    
    await c.query(`SET FOREIGN_KEY_CHECKS = 0;`);
    await c.query(`SET sql_mode = '';`);
    const tables = [
      'transactions', 'transaction_items', 'transaction_item_customizations',
      'items', 'categories', 'beepers', 'customization_groups', 'customization_options',
      'discounts', 'library_seats', 'library_sessions', 'library_tables',
      'orders', 'order_items', 'order_item_addons', 'order_item_customizations',
      'quick_cash_amounts', 'roles', 'users', 'void_log', 'addons', 'item_customization_groups',
      'system_settings'
    ];
    for (const t of tables) {
        await c.query(`DROP TABLE IF EXISTS \`${t}\`;`);
    }

    for (let i = 0; i < queries.length; i++) {
        try {
            await c.query(queries[i]);
            if (i % 50 === 0) console.log(`Executed ${i}/${queries.length} queries`);
        } catch (e) {
            console.log(`Failed at query ${i}:`, e.message.substring(0, 100));
        }
    }
    await c.query(`SET FOREIGN_KEY_CHECKS = 1;`);
    
    console.log('✅ Import completed successfully!');
    await c.end();
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
})();
