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

  // Fix roles table
  await c.query('DROP TABLE IF EXISTS roles');
  await c.query(`
    CREATE TABLE roles (
      role_id int NOT NULL AUTO_INCREMENT,
      role_name varchar(50) NOT NULL,
      PRIMARY KEY (role_id)
    ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await c.query("INSERT INTO roles (role_id, role_name) VALUES (1, 'Admin'), (2, 'Cashier')");
  console.log('✅ roles fixed with role_name column, data inserted');

  // Verify
  const [roles] = await c.query('SELECT * FROM roles');
  console.log('Roles:', roles);

  // Now test kiosk order INSERT
  console.log('\n=== Testing kiosk order INSERT ===');
  try {
    const [result] = await c.query(`
      INSERT INTO transactions (
        beeper_number, order_type, subtotal, total_amount, status, library_booking
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [20, 'dine-in', 150.00, 150.00, 'pending', null]);

    console.log(`✅ INSERT succeeded! transaction_id = ${result.insertId}`);

    // Also test transaction_items insert
    const [tiResult] = await c.query(`
      INSERT INTO transaction_items (
        transaction_id, item_id, item_name, quantity, unit_price, total_price
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [result.insertId, 2, 'Americano', 1, 150.00, 150.00]);
    console.log(`✅ transaction_items INSERT succeeded! id = ${tiResult.insertId}`);

    // Clean up
    await c.query('DELETE FROM transaction_items WHERE transaction_item_id = ?', [tiResult.insertId]);
    await c.query('DELETE FROM transactions WHERE transaction_id = ?', [result.insertId]);
    console.log('✅ Test records cleaned up');
  } catch(e) {
    console.log(`❌ INSERT failed: ${e.message}`);
  }

  // Check item images
  console.log('\n=== Item images ===');
  const [items] = await c.query('SELECT item_id, name, LENGTH(image) as img_len FROM items');
  items.forEach(i => console.log(`  ${i.item_id}: ${i.name} - image: ${i.img_len ? i.img_len + ' bytes' : 'NULL ⚠️'}`));

  // Check users
  console.log('\n=== Users ===');
  const [users] = await c.query('SELECT user_id, full_name, username, role_id FROM users');
  console.log(users);

  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  await c.end();
  console.log('\nDone!');
})();
