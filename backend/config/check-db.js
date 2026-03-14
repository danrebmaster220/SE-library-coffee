const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false }
};

(async () => {
    try {
        const c = await mysql.createConnection(CONFIG);
        const [tables] = await c.query('SHOW TABLES');
        
        console.log(`Found ${tables.length} tables`);
        for(let t of tables) {
            const tableName = Object.values(t)[0];
            const [rows] = await c.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
            console.log(`- ${tableName}: ${rows[0].count} rows`);
        }
        await c.end();
    } catch(err) {
        console.error(err);
    }
})();
