const mysql = require('mysql2/promise');
const fs = require('fs');

const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
  maxAllowedPacket: 64 * 1024 * 1024
};

(async () => {
  const conn = await mysql.createConnection(CONFIG);
  console.log('Connected!');

  // Read original SQL with base64 images
  const sql = fs.readFileSync(__dirname + '/coffee_database.sql', 'utf8');
  
  // Extract all INSERT INTO `items` statements (they span 1-2 lines each)
  const lines = sql.split('\n');
  const itemInserts = [];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("INSERT INTO `items`")) {
      let stmt = lines[i];
      // The next line has the actual values
      if (i + 1 < lines.length && !lines[i+1].startsWith('INSERT') && !lines[i+1].startsWith('--') && !lines[i+1].startsWith('CREATE')) {
        stmt += '\n' + lines[i+1];
      }
      // Make sure it ends with semicolon
      if (!stmt.trim().endsWith(';')) {
        stmt = stmt.trim() + ';';
      }
      itemInserts.push(stmt);
    }
  }
  
  console.log(`Found ${itemInserts.length} item INSERT statements`);
  
  // Delete existing items (without images) first
  // Need to remove FK constraints temporarily
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  await conn.query('DELETE FROM items');
  console.log('Cleared items table');
  
  // Insert each item with original base64 image
  let ok = 0, fail = 0;
  for (const stmt of itemInserts) {
    try {
      // Convert INSERT to REPLACE to handle duplicates
      const replaceStmt = stmt.replace('INSERT INTO', 'REPLACE INTO');
      await conn.query(replaceStmt);
      ok++;
      process.stdout.write('.');
    } catch(e) {
      fail++;
      console.log(`\n❌ ${e.message.substring(0, 80)}`);
    }
  }
  
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  
  const [count] = await conn.query('SELECT COUNT(*) as cnt FROM items WHERE image IS NOT NULL AND image != ""');
  console.log(`\n\n✅ Items with images: ${count[0].cnt}`);
  
  const [all] = await conn.query('SELECT item_id, name, LENGTH(image) as img_size FROM items');
  for (const row of all) {
    console.log(`  ${row.item_id}: ${row.name} - image: ${row.img_size ? (row.img_size/1024).toFixed(1)+'KB' : 'NONE'}`);
  }
  
  await conn.end();
})();
