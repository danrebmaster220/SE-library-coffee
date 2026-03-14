const fs = require('fs');
const sql = fs.readFileSync('config/coffee_database.sql', 'utf8');

// Find each INSERT INTO items with its image
const pattern = /INSERT INTO `items`[^;]*?VALUES\s*\((\d+),\s*(\d+),\s*'([^']*)'[^;]*?'(data:image\/[^']*?)'/g;

let match;
while ((match = pattern.exec(sql)) !== null) {
  const itemId = match[1];
  const name = match[3];
  const image = match[4];
  console.log(`Item ${itemId} (${name}): image length = ${image.length}`);
}

// Also check: is the image the same for all?
const allImages = [];
const pattern2 = /INSERT INTO `items`[^;]*?VALUES\s*\(\d+,\s*\d+,\s*'[^']*'[^;]*?'(data:image\/[^']*?)'/g;
let m2;
while ((m2 = pattern2.exec(sql)) !== null) {
  allImages.push(m2[1].substring(0, 50));
}
console.log('\nFirst 50 chars of each image:');
allImages.forEach((img, i) => console.log(`  ${i}: ${img}`));
