const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
      port: 4000,
      user: 'zuSFWPhNSUnf7Cu.root',
      password: 'Iwwb1dWcJZZrknRy',
      database: 'test',
      ssl: { rejectUnauthorized: false },
      connectTimeout: 15000
    });
    console.log('CONNECTED TO TIDB!');
    const [rows] = await conn.execute('SELECT 1 as test');
    console.log('Query OK:', rows);
    await conn.end();
  } catch(e) {
    console.log('ERROR:', e.message);
  }
})();
