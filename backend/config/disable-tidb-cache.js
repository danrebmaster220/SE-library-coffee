const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' }); // Make sure to load env vars

const CONFIG = {
  host: process.env.DB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER || 'zuSFWPhNSUnf7Cu.root',
  password: process.env.DB_PASS || 'Iwwb1dWcJZZrknRy',
  database: process.env.DB_NAME || 'test',
  ssl: { rejectUnauthorized: false }
};

(async () => {
  try {
    const c = await mysql.createConnection(CONFIG);
    console.log('Connected to TiDB successfully!');

    const tables = [
      'transactions', 'transaction_items', 'transaction_item_customizations',
      'items', 'categories', 'beepers', 'customization_groups', 'customization_options',
      'discounts', 'library_seats', 'library_sessions', 'library_tables',
      'orders', 'order_items', 'order_item_addons', 'order_item_customizations',
      'quick_cash_amounts', 'roles', 'users', 'void_log', 'addons', 'item_customization_groups'
    ];

    console.log('\nDisabling AUTO_ID_CACHE for TiDB tables to prevent ID jumping...');

    for (const t of tables) {
      try {
        await c.query(`ALTER TABLE \`${t}\` AUTO_ID_CACHE = 1;`);
        console.log(`✅ ${t}: AUTO_ID_CACHE = 1`);
      } catch (err) {
        // Ignored, some tables might not exist or might not have auto_increment
        console.log(`⚠️ ${t}: ${err.message.substring(0, 80)}`);
      }
    }

    await c.end();
    console.log('\nDone applying AUTO_ID_CACHE = 1 to all tables!');
  } catch (error) {
    console.error('Connection failed:', error.message);
  }
})();
