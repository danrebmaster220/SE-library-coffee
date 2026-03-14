const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'sql.freedb.tech',
      port: 3306,
      user: 'freedb_coffee_user',
      password: '&$KkwZTDEzNFPn2',
      database: 'freedb_coffee_db',
      connectTimeout: 15000,
      ssl: { rejectUnauthorized: false }
    });
    console.log('CONNECTED!');
    const [rows] = await conn.execute('SELECT 1 as test');
    console.log('Query OK:', rows);
    await conn.end();
  } catch(e) {
    console.log('ERROR:', e.message);
  }
})();
