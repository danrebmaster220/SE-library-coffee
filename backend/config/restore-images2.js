const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
  const sqlFile = fs.readFileSync(path.join(__dirname, 'coffee_database.sql'), 'utf8');
  
  // Find each INSERT INTO items statement individually
  const insertPattern = /INSERT INTO `items`[^;]*?VALUES\s*\((\d+),\s*(\d+),\s*'([^']*)'[^;]*?'(data:image\/[^']*?)'/gs;
  
  const imageMap = {};
  let match;
  while ((match = insertPattern.exec(sqlFile)) !== null) {
    const itemId = parseInt(match[1]);
    const name = match[3];
    const image = match[4];
    imageMap[itemId] = { name, image, len: image.length };
  }
  
  console.log('Images found in SQL file:');
  for (const [id, data] of Object.entries(imageMap)) {
    console.log(`  Item ${id} (${data.name}): ${data.len} bytes`);
  }
  
  // Current DB items
  const [currentItems] = await c.query('SELECT item_id, name FROM items');
  console.log('\nCurrent DB items:', currentItems.map(i => `${i.item_id}:${i.name}`).join(', '));
  
  // Update images for items that exist in both
  console.log('\n--- Updating images ---');
  for (const item of currentItems) {
    if (imageMap[item.item_id]) {
      await c.query('UPDATE items SET image = ? WHERE item_id = ?', [imageMap[item.item_id].image, item.item_id]);
      console.log(`✅ ${item.item_id} (${item.name}): ${imageMap[item.item_id].len} bytes`);
    } else {
      // Some items were added later and don't have images in the original SQL
      // Let's check if any other item shares the same name
      console.log(`⚠️ ${item.item_id} (${item.name}): No image in original SQL`);
    }
  }
  
  // Verify
  console.log('\n=== Final Image Verification ===');
  const [items] = await c.query('SELECT item_id, name, LENGTH(image) as img_len FROM items');
  items.forEach(i => console.log(`  ${i.item_id}: ${i.name} - ${i.img_len ? i.img_len + ' bytes ✅' : 'NULL ❌'}`));
  
  await c.end();
  console.log('\nDone!');
})();
