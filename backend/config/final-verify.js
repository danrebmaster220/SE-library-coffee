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

  // Re-insert roles data
  const [roleCount] = await c.query('SELECT COUNT(*) as c FROM roles');
  if (roleCount[0].c === 0) {
    await c.query(`INSERT INTO roles (role_id, role_name) VALUES (1, 'Admin'), (2, 'Cashier')`);
    console.log('✅ Roles restored: Admin, Cashier');
  } else {
    console.log('Roles already have data');
  }

  // Verify users
  const [users] = await c.query('SELECT user_id, full_name, username, role_id FROM users');
  console.log('\nUsers:', users);

  // Now test kiosk order creation directly!
  console.log('\n=== Testing kiosk order INSERT ===');
  
  try {
    const [result] = await c.query(`
      INSERT INTO transactions (
        beeper_number, order_type, subtotal, total_amount, status, library_booking
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [20, 'dine-in', 150.00, 150.00, 'pending', null]);

    console.log(`✅ INSERT succeeded! transaction_id = ${result.insertId}`);

    // Clean up test record
    await c.query('DELETE FROM transactions WHERE transaction_id = ?', [result.insertId]);
    console.log('✅ Test record cleaned up');
  } catch(e) {
    console.log(`❌ INSERT failed: ${e.message}`);
  }

  // Also restore item images
  console.log('\n=== Checking item images ===');
  const [items] = await c.query('SELECT item_id, name, LENGTH(image) as img_len FROM items');
  items.forEach(i => console.log(`  ${i.item_id}: ${i.name} - image: ${i.img_len ? i.img_len + ' bytes' : 'NULL'}`));

  await c.end();
  console.log('\nDone!');
})();
