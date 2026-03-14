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

  // Fix users - use original data from SQL dump
  await c.query('DELETE FROM users');
  await c.query(`
    INSERT INTO users (user_id, role_id, full_name, username, password_hash, status, created_at) VALUES
    (4, 1, 'Joy Boy', 'admin', '$2b$10$gOBPPrYV0d0sLF7jdSJ15ucqOWLIylI2v.5c.l0nrGhwqIjzi9HNy', 'active', '2025-11-28 22:02:55'),
    (5, 2, 'John', 'cashier', '$2b$10$gOBPPrYV0d0sLF7jdSJ15ucqOWLIylI2v.5c.l0nrGhwqIjzi9HNy', 'active', '2025-11-28 22:02:55')
  `);
  console.log('✅ Users fixed with correct password hashes and usernames');

  // Verify
  const [users] = await c.query('SELECT user_id, full_name, username, role_id, status FROM users');
  console.log(users);

  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  await c.end();
})();
