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
  
  // Read original SQL file and extract base64 images for each item
  const sqlFile = fs.readFileSync(path.join(__dirname, 'coffee_database.sql'), 'utf8');
  
  // Find all INSERT INTO items statements and extract image data
  // Images start with 'data:image/' and end before the next field
  const itemIds = [2, 3, 5, 6, 8, 9, 11, 14];
  
  for (const itemId of itemIds) {
    // Find the line with this item_id in the items INSERT
    // Pattern: (item_id, category_id, name, ..., 'data:image/...', ...)
    const regex = new RegExp(`\\(${itemId},\\s*\\d+,\\s*'[^']*'.*?'(data:image[^']*)'`, 's');
    const match = sqlFile.match(regex);
    
    if (match) {
      const imageData = match[1];
      await c.query('UPDATE items SET image = ? WHERE item_id = ?', [imageData, itemId]);
      console.log(`✅ Updated image for item ${itemId} (${imageData.substring(0, 30)}... ${imageData.length} bytes)`);
    } else {
      // Try alternate approach - look for the specific item INSERT
      console.log(`⚠️ No image found for item ${itemId} in SQL file`);
    }
  }
  
  // Verify
  console.log('\n=== Verification ===');
  const [items] = await c.query('SELECT item_id, name, LENGTH(image) as img_len FROM items');
  items.forEach(i => console.log(`  ${i.item_id}: ${i.name} - ${i.img_len ? i.img_len + ' bytes ✅' : 'NULL ❌'}`));
  
  await c.end();
  console.log('\nDone!');
})();
