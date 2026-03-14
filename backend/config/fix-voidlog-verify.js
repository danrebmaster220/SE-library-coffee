const mysql = require('mysql2/promise');
const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false }
};

(async () => {
  const c = await mysql.createConnection(CONFIG);
  await c.query('SET FOREIGN_KEY_CHECKS = 0');

  // Fix void_log - drop and recreate with beeper_number + action_type + refund_amount
  await c.query('DROP TABLE IF EXISTS void_log');
  await c.query(`
    CREATE TABLE void_log (
      void_id int NOT NULL AUTO_INCREMENT,
      transaction_id int NOT NULL,
      beeper_number int NOT NULL,
      voided_by int NOT NULL,
      void_reason text DEFAULT NULL,
      original_amount decimal(10,2) NOT NULL,
      voided_at datetime DEFAULT CURRENT_TIMESTAMP,
      action_type varchar(20) DEFAULT 'void',
      refund_amount decimal(10,2) DEFAULT NULL,
      PRIMARY KEY (void_id),
      KEY transaction_id (transaction_id),
      KEY voided_by (voided_by),
      CONSTRAINT void_log_ibfk_1 FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id),
      CONSTRAINT void_log_ibfk_2 FOREIGN KEY (voided_by) REFERENCES users (user_id)
    ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  console.log('✅ Recreated void_log with correct schema');

  // Insert void_log data
  await c.query(`
    INSERT INTO void_log (void_id, transaction_id, beeper_number, voided_by, void_reason, original_amount, voided_at) VALUES
    (1, 27, 2, 5, 'Customer Refund', 245.60, '2025-12-01 17:50:27'),
    (2, 36, 1, 4, 'error input', 100.00, '2025-12-04 03:30:59')
  `);
  console.log('✅ void_log data inserted');

  // Now fix the remaining 5 tables that already exist but need AUTO_INCREMENT
  // (orders, order_items, order_item_addons, order_item_customizations, addons)
  // These were already fixed in rebuild-autoincrement.js — let's verify

  console.log('\n=== FULL AUTO_INCREMENT VERIFICATION ===');
  const allTables = [
    { table: 'transactions', col: 'transaction_id' },
    { table: 'transaction_items', col: 'transaction_item_id' },
    { table: 'transaction_item_customizations', col: 'id' },
    { table: 'items', col: 'item_id' },
    { table: 'orders', col: 'order_id' },
    { table: 'order_items', col: 'order_item_id' },
    { table: 'order_item_addons', col: 'id' },
    { table: 'order_item_customizations', col: 'id' },
    { table: 'users', col: 'user_id' },
    { table: 'void_log', col: 'void_id' },
    { table: 'addons', col: 'addon_id' },
    { table: 'categories', col: 'category_id' },
    { table: 'customization_groups', col: 'group_id' },
    { table: 'customization_options', col: 'option_id' },
    { table: 'discounts', col: 'discount_id' },
    { table: 'item_customization_groups', col: 'id' },
    { table: 'library_seats', col: 'seat_id' },
    { table: 'library_sessions', col: 'session_id' },
    { table: 'library_tables', col: 'table_id' },
    { table: 'quick_cash_amounts', col: 'id' },
    { table: 'roles', col: 'role_id' },
  ];

  for (const t of allTables) {
    try {
      const [cols] = await c.query(`SHOW COLUMNS FROM \`${t.table}\` WHERE Field = ?`, [t.col]);
      const hasAI = cols[0]?.Extra.includes('auto_increment');
      const [cnt] = await c.query(`SELECT COUNT(*) as c FROM \`${t.table}\``);
      console.log(`${hasAI ? '✅' : '❌'} ${t.table}.${t.col} (${cnt[0].c} rows)`);
    } catch (e) {
      console.log(`❌ ${t.table}: ${e.message.substring(0, 60)}`);
    }
  }

  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  await c.end();
  console.log('\nDone!');
})();
