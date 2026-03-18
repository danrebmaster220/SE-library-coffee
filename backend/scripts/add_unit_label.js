const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await c.query('ALTER TABLE customization_groups ADD COLUMN unit_label VARCHAR(50) DEFAULT NULL');
    console.log('SUCCESS: unit_label column added');
  } catch(e) {
    if (e.message.includes('Duplicate') || e.message.includes('duplicate')) {
      console.log('Column already exists');
    } else {
      console.log('ALTER error:', e.code, e.message.substring(0, 200));
    }
  }

  // Verify
  try {
    const [rows] = await c.query('SELECT group_id, name, unit_label FROM customization_groups LIMIT 3');
    console.log('VERIFY - columns exist:', JSON.stringify(rows));
  } catch(e2) {
    console.log('VERIFY failed:', e2.message.substring(0, 100));
  }

  await c.end();
  process.exit(0);
})();
