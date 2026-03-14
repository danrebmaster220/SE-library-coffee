const mysql = require('mysql2/promise');

const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000
};

(async () => {
  const conn = await mysql.createConnection(CONFIG);
  console.log('Connected!');

  // Check all tables for duplicate counts
  const tables = [
    'categories', 'items', 'beepers', 'customization_groups', 
    'customization_options', 'discounts', 'roles', 'users',
    'system_settings', 'quick_cash_amounts', 'library_tables',
    'library_seats', 'library_sessions', 'item_customization_groups',
    'transactions', 'transaction_items', 'transaction_item_customizations',
    'void_log'
  ];

  for (const table of tables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`${table}: ${rows[0].cnt} rows`);
  }

  console.log('\n--- Cleaning duplicates ---\n');

  // Drop all data and re-import cleanly
  // Disable FK checks
  await conn.query('SET FOREIGN_KEY_CHECKS=0');

  // Clear all tables
  for (const table of tables) {
    await conn.query(`DELETE FROM \`${table}\``);
    console.log(`Cleared ${table}`);
  }

  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log('\nAll tables cleared. Ready for clean import.');

  await conn.end();
})();
