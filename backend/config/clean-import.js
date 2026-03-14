const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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
  
  await conn.query('SET FOREIGN_KEY_CHECKS=0');

  // Read chunk2 (all non-item inserts)
  let chunk2 = fs.readFileSync(path.join(__dirname, 'chunk2_inserts.sql'), 'utf8');
  
  // Fix empty order_type '' -> 'dine-in'
  chunk2 = chunk2.replace(/, '',/g, ", 'dine-in',");
  
  // Split into individual INSERT statements
  const statements = chunk2.split(';')
    .map(s => s.trim())
    .filter(s => s.startsWith('INSERT'));

  console.log(`Processing ${statements.length} INSERT statements...`);
  
  let ok = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      const table = stmt.match(/INSERT INTO `(\w+)`/);
      if (table) process.stdout.write(`✅ ${table[1]} `);
      ok++;
    } catch(e) {
      const table = stmt.match(/INSERT INTO `(\w+)`/);
      console.log(`\n❌ ${table ? table[1] : '?'}: ${e.message.substring(0, 80)}`);
      fail++;
    }
  }
  console.log(`\n\nInserts: ${ok} OK, ${fail} failed`);

  // Now insert items with images from original SQL
  console.log('\nInserting items with images...');
  const originalSql = fs.readFileSync(path.join(__dirname, 'coffee_database.sql'), 'utf8');
  const lines = originalSql.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("INSERT INTO `items`")) {
      const valLine = lines[i+1];
      const idMatch = valLine.match(/^\((\d+),/);
      if (idMatch) {
        const imgMatch = valLine.match(/'(data:image\/[^']*)'/);
        const fieldMatch = valLine.match(/^\((\d+),\s*(\d+),\s*'([^']*)',\s*(NULL|'[^']*'),\s*([\d.]+),\s*'([^']*)',\s*'([^']*)',/);
        if (fieldMatch) {
          const [_, id, catId, name, desc, price, station, status] = fieldMatch;
          const descVal = desc === 'NULL' ? null : desc.replace(/'/g, '');
          const image = imgMatch ? imgMatch[1] : null;
          const custMatch = valLine.match(/,\s*(\d+)\);?\s*$/);
          const isCust = custMatch ? parseInt(custMatch[1]) : 1;
          const dateMatch = valLine.match(/'(\d{4}-\d{2}-\d{2}\s[\d:]+)'/);
          const createdAt = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0,19);
          
          try {
            await conn.execute(
              'INSERT INTO items (item_id, category_id, name, description, price, station, status, image, created_at, is_customizable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [parseInt(id), parseInt(catId), name, descVal, parseFloat(price), station, status, image, createdAt, isCust]
            );
            console.log(`✅ Item ${id}: ${name}`);
          } catch(e) {
            console.log(`❌ Item ${id}: ${e.message.substring(0, 60)}`);
          }
        }
      }
    }
  }

  await conn.query('SET FOREIGN_KEY_CHECKS=1');

  // Final verification
  console.log('\n--- Final counts ---');
  const checkTables = ['categories','items','beepers','customization_groups','customization_options',
    'discounts','roles','users','system_settings','quick_cash_amounts',
    'library_tables','library_seats','library_sessions','item_customization_groups',
    'transactions','transaction_items','transaction_item_customizations','void_log'];
  
  for (const t of checkTables) {
    const [r] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    console.log(`  ${t}: ${r[0].cnt}`);
  }

  await conn.end();
  console.log('\n✅ Clean import complete!');
})();
