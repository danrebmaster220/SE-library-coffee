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
  await c.query('SET FOREIGN_KEY_CHECKS = 0');

  // Tables that need AUTO_INCREMENT added
  const tables = [
    { name: 'roles', col: 'role_id', nextId: 4 },
    { name: 'categories', col: 'category_id', nextId: 13 },
    { name: 'customization_groups', col: 'group_id', nextId: 9 },
    { name: 'customization_options', col: 'option_id', nextId: 22 },
    { name: 'discounts', col: 'discount_id', nextId: 3 },
    { name: 'item_customization_groups', col: 'id', nextId: 124 },
    { name: 'library_tables', col: 'table_id', nextId: 4 },
    { name: 'library_seats', col: 'seat_id', nextId: 25 },
    { name: 'library_sessions', col: 'session_id', nextId: 18 },
    { name: 'quick_cash_amounts', col: 'id', nextId: 7 },
  ];

  for (const t of tables) {
    console.log(`\n=== ${t.name} ===`);
    
    try {
      // 1. Backup data
      const [rows] = await c.query(`SELECT * FROM \`${t.name}\``);
      console.log(`  Backed up ${rows.length} rows`);

      // 2. Get CREATE TABLE
      const [createResult] = await c.query(`SHOW CREATE TABLE \`${t.name}\``);
      let createSQL = createResult[0]['Create Table'];

      // 3. Drop table
      await c.query(`DROP TABLE \`${t.name}\``);

      // 4. Modify CREATE TABLE: add AUTO_INCREMENT to the PK column
      // Pattern: `col_name` int NOT NULL -> `col_name` int NOT NULL AUTO_INCREMENT
      const colEscaped = t.col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('(`' + colEscaped + '`\\s+int(?:\\(\\d+\\))?\\s+NOT NULL)', 'i');
      createSQL = createSQL.replace(regex, '$1 AUTO_INCREMENT');

      // 5. Add AUTO_INCREMENT=N before ENGINE= or at the end
      // TiDB format: ) ENGINE=InnoDB DEFAULT CHARSET=...
      createSQL = createSQL.replace(
        /\)\s*ENGINE=/i,
        `) AUTO_INCREMENT=${t.nextId} ENGINE=`
      );

      // 6. Execute
      await c.query(createSQL);
      console.log(`  Recreated with AUTO_INCREMENT`);

      // 7. Restore data
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const colNames = cols.map(c => `\`${c}\``).join(',');
        const placeholders = cols.map(() => '?').join(',');
        
        for (const row of rows) {
          const values = cols.map(c => row[c]);
          await c.query(`INSERT INTO \`${t.name}\` (${colNames}) VALUES (${placeholders})`, values);
        }
        console.log(`  Restored ${rows.length} rows`);
      }

      // 8. Verify
      const [verCols] = await c.query(`SHOW COLUMNS FROM \`${t.name}\` WHERE Field = ?`, [t.col]);
      console.log(`  AUTO_INCREMENT: ${verCols[0].Extra.includes('auto_increment') ? '✅' : '❌'}`);
    } catch (e) {
      console.error(`  ❌ ERROR: ${e.message.substring(0, 150)}`);
    }
  }

  await c.query('SET FOREIGN_KEY_CHECKS = 1');

  // Final full check
  console.log('\n\n=== FINAL FULL VERIFICATION ===');
  const allTables = [
    'transactions', 'transaction_items', 'transaction_item_customizations',
    'items', 'orders', 'order_items', 'order_item_addons', 'order_item_customizations',
    'users', 'void_log', 'addons', 'categories', 'customization_groups',
    'customization_options', 'discounts', 'item_customization_groups',
    'library_seats', 'library_sessions', 'library_tables',
    'quick_cash_amounts', 'roles'
  ];

  let allOk = true;
  for (const t of allTables) {
    const [cols] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    const pk = cols.find(c => c.Key === 'PRI' && c.Type.includes('int'));
    if (pk) {
      const hasAI = pk.Extra.includes('auto_increment');
      if (!hasAI) allOk = false;
      const [cnt] = await c.query(`SELECT COUNT(*) as c FROM \`${t}\``);
      console.log(`${hasAI ? '✅' : '❌'} ${t}.${pk.Field} (${cnt[0].c} rows)`);
    }
  }

  console.log(allOk ? '\n🎉 ALL TABLES HAVE AUTO_INCREMENT!' : '\n⚠️ Some tables still missing AUTO_INCREMENT');

  await c.end();
})();
