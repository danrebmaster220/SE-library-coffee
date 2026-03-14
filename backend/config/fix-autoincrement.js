const mysql = require('mysql2/promise');
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

  // Check which primary key int columns are missing AUTO_INCREMENT
  const tables = [
    'transactions', 'transaction_items', 'transaction_item_customizations',
    'items', 'categories', 'beepers', 'customization_groups', 'customization_options',
    'discounts', 'library_seats', 'library_sessions', 'library_tables',
    'orders', 'order_items', 'order_item_addons', 'order_item_customizations',
    'quick_cash_amounts', 'roles', 'users', 'void_log', 'addons', 'item_customization_groups'
  ];

  const needsFix = [];

  for (const t of tables) {
    const [cols] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    for (const col of cols) {
      if (col.Key === 'PRI' && col.Type.includes('int')) {
        if (col.Extra.includes('auto_increment')) {
          console.log(`✅ ${t}.${col.Field} - AUTO_INCREMENT OK`);
        } else {
          console.log(`❌ ${t}.${col.Field} - MISSING AUTO_INCREMENT`);
          needsFix.push({ table: t, column: col.Field });
        }
      }
    }
  }

  // Fix missing AUTO_INCREMENT
  if (needsFix.length > 0) {
    console.log(`\n--- Fixing ${needsFix.length} tables ---\n`);
    for (const fix of needsFix) {
      try {
        // Get max ID first
        const [maxRow] = await c.query(`SELECT COALESCE(MAX(\`${fix.column}\`), 0) as maxId FROM \`${fix.table}\``);
        const nextId = maxRow[0].maxId + 1;
        
        // TiDB supports ALTER TABLE ... AUTO_INCREMENT directly if column is already PK
        // But we need to modify the column to add AUTO_INCREMENT
        await c.query(`ALTER TABLE \`${fix.table}\` MODIFY \`${fix.column}\` INT NOT NULL AUTO_INCREMENT`);
        
        // Set next auto_increment value
        await c.query(`ALTER TABLE \`${fix.table}\` AUTO_INCREMENT = ${nextId}`);
        
        console.log(`✅ Fixed ${fix.table}.${fix.column} (next ID: ${nextId})`);
      } catch(e) {
        console.log(`❌ Failed ${fix.table}.${fix.column}: ${e.message.substring(0, 80)}`);
      }
    }
  }

  await c.end();
  console.log('\nDone!');
})();
