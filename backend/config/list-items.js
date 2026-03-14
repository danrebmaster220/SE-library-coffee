const fs = require('fs');
const sql = fs.readFileSync(__dirname + '/coffee_database.sql', 'utf8');

// Find all item data
const lines = sql.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("INSERT INTO `items`")) {
    // Next line has values
    const valLine = lines[i+1];
    const match = valLine.match(/^\((\d+),\s*(\d+),\s*'([^']*)'/);
    if (match) {
      console.log(`Line ${i+1}: item_id=${match[1]}, category=${match[2]}, name='${match[3]}'`);
    }
  }
}
