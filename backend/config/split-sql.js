const fs = require('fs');
let sql = fs.readFileSync(__dirname + '/filess_clean.sql', 'utf8');

const lines = sql.split('\n');
let statements = [];
let current = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('--')) continue;
  current += line + '\n';
  if (trimmed.endsWith(';')) {
    statements.push(current.trim());
    current = '';
  }
}

console.log('Total statements:', statements.length);

const creates = statements.filter(s => s.startsWith('CREATE'));
const inserts = statements.filter(s => s.startsWith('INSERT'));
const alters  = statements.filter(s => s.startsWith('ALTER'));

console.log('CREATE:', creates.length);
console.log('INSERT:', inserts.length);
console.log('ALTER: ', alters.length);

// Show INSERT tables
const tablePattern = /INSERT INTO `(\w+)`/;
console.log('\nInsert tables:');
inserts.forEach(s => {
  const m = s.match(tablePattern);
  if (m) process.stdout.write(m[1] + ' ');
});
console.log('\n');

// Write chunk 1: all CREATEs
const chunk1 = 'SET FOREIGN_KEY_CHECKS=0;\n\n' + creates.join('\n\n') + '\n\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync(__dirname + '/chunk1_create.sql', chunk1);
console.log('chunk1_create.sql size:', (chunk1.length/1024).toFixed(1), 'KB');

// Write chunk 2: all INSERTs except items (which have images → NULL now)
const nonItemInserts = inserts.filter(s => {
  const m = s.match(tablePattern);
  return m && m[1] !== 'items';
});
const itemInserts = inserts.filter(s => {
  const m = s.match(tablePattern);
  return m && m[1] === 'items';
});

const chunk2 = 'SET FOREIGN_KEY_CHECKS=0;\n\n' + nonItemInserts.join('\n\n') + '\n\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync(__dirname + '/chunk2_inserts.sql', chunk2);
console.log('chunk2_inserts.sql size:', (chunk2.length/1024).toFixed(1), 'KB');

const chunk3 = 'SET FOREIGN_KEY_CHECKS=0;\n\n' + itemInserts.join('\n\n') + '\n\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync(__dirname + '/chunk3_items.sql', chunk3);
console.log('chunk3_items.sql size:', (chunk3.length/1024).toFixed(1), 'KB');

// Write chunk 4: ALTERs (indexes, AUTO_INCREMENT, FKs)
const chunk4 = 'SET FOREIGN_KEY_CHECKS=0;\n\n' + alters.join('\n\n') + '\n\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync(__dirname + '/chunk4_alters.sql', chunk4);
console.log('chunk4_alters.sql size:', (chunk4.length/1024).toFixed(1), 'KB');

console.log('\nAll chunks written.');
