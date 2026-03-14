const mysql = require('mysql2/promise');
const fs = require('fs');

const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000
};

(async () => {
  const conn = await mysql.createConnection(CONFIG);
  console.log('Connected!');

  const sql = fs.readFileSync(__dirname + '/coffee_database.sql', 'utf8');
  const lines = sql.split('\n');

  // Find items 6 and 11 which are missing
  const missingIds = [6, 11];
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("INSERT INTO `items`")) {
      const valLine = lines[i+1];
      const idMatch = valLine.match(/^\((\d+),/);
      if (idMatch && missingIds.includes(parseInt(idMatch[1]))) {
        const itemId = idMatch[1];
        // Extract image from the value line
        const imgMatch = valLine.match(/'(data:image\/[^']*)'/);
        if (imgMatch) {
          const image = imgMatch[1];
          // Extract other fields
          const fieldMatch = valLine.match(/^\((\d+),\s*(\d+),\s*'([^']*)',\s*(NULL|'[^']*'),\s*([\d.]+),\s*'([^']*)',\s*'([^']*)',/);
          if (fieldMatch) {
            const [_, id, catId, name, desc, price, station, status] = fieldMatch;
            const descVal = desc === 'NULL' ? null : desc.replace(/'/g, '');
            
            console.log(`Inserting item ${id}: ${name}`);
            await conn.execute(
              'INSERT INTO items (item_id, category_id, name, description, price, station, status, image, created_at, is_customizable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)',
              [parseInt(id), parseInt(catId), name, descVal, parseFloat(price), station, status, image]
            );
            console.log(`✅ Item ${id} inserted with image`);
          }
        }
      }
    }
  }

  // Final verification
  const [rows] = await conn.query('SELECT item_id, name, CASE WHEN image IS NOT NULL AND image != \'\' THEN \'YES\' ELSE \'NO\' END as has_image FROM items ORDER BY item_id');
  console.log('\nAll items:');
  for (const r of rows) {
    console.log(`  ${r.item_id}: ${r.name} - image: ${r.has_image}`);
  }

  await conn.end();
})();
