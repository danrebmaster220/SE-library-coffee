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

  // Read original SQL
  const sql = fs.readFileSync(__dirname + '/coffee_database.sql', 'utf8');

  // Extract item_id and image pairs using regex
  // Pattern: (item_id, category_id, 'name', ..., 'data:image/...base64,...', ...)
  const itemRegex = /\((\d+),\s*\d+,\s*'[^']*',\s*(?:NULL|'[^']*'),\s*[\d.]+,\s*'[^']*',\s*'[^']*',\s*('data:image\/[^']*'),/g;
  
  let match;
  let updates = [];
  while ((match = itemRegex.exec(sql)) !== null) {
    updates.push({ id: parseInt(match[1]), image: match[2] });
  }

  console.log(`Found ${updates.length} items with images`);

  for (const item of updates) {
    try {
      // Use parameterized query to avoid SQL injection / escaping issues
      const imgStr = item.image.slice(1, -1); // remove surrounding quotes
      await conn.execute('UPDATE items SET image = ? WHERE item_id = ?', [imgStr, item.id]);
      console.log(`✅ Updated item ${item.id}`);
    } catch(e) {
      console.log(`❌ Item ${item.id}: ${e.message.substring(0, 60)}`);
    }
  }

  // Verify
  const [rows] = await conn.query('SELECT item_id, name, CASE WHEN image IS NOT NULL AND image != \'\' THEN \'YES\' ELSE \'NO\' END as has_image FROM items ORDER BY item_id');
  console.log('\nResults:');
  for (const r of rows) {
    console.log(`  ${r.item_id}: ${r.name} - image: ${r.has_image}`);
  }

  await conn.end();
})();
