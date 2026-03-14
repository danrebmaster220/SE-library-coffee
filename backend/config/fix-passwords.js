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

  // Update password hashes to known password: password123
  const newHash = '$2b$10$n4J8j4IqUNk/9urZqDozveNmKZBo.zRDz2iz7rmlOfk0K16eRLVhS';
  
  await c.query('UPDATE users SET password_hash = ?', [newHash]);
  console.log('✅ Updated all users to password: password123');

  const [users] = await c.query('SELECT user_id, username, full_name, role_id FROM users');
  console.log(users);

  await c.end();
})();
