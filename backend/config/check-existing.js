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

  // Check which tables still exist
  const [tables] = await c.query(`SHOW TABLES`);
  console.log('Existing tables:');
  tables.forEach(t => console.log(' ', Object.values(t)[0]));

  // Get CREATE TABLE for one existing table to understand the format
  const [create] = await c.query(`SHOW CREATE TABLE categories`);
  console.log('\n--- categories CREATE TABLE ---');
  console.log(create[0]['Create Table']);

  await c.end();
})();
