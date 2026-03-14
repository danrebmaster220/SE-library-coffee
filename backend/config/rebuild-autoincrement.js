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

  const fixes = [
    { table: 'transaction_item_customizations', col: 'id', nextId: 136 },
    { table: 'transaction_items', col: 'transaction_item_id', nextId: 51 },
    { table: 'void_log', col: 'void_id', nextId: 3 },
    { table: 'transactions', col: 'transaction_id', nextId: 51 },
    { table: 'order_item_addons', col: 'id', nextId: 1 },
    { table: 'order_item_customizations', col: 'id', nextId: 1 },
    { table: 'order_items', col: 'order_item_id', nextId: 1 },
    { table: 'orders', col: 'order_id', nextId: 1 },
    { table: 'items', col: 'item_id', nextId: 15 },
    { table: 'users', col: 'user_id', nextId: 7 },
    { table: 'addons', col: 'addon_id', nextId: 1 },
  ];

  // We need to handle foreign key dependencies carefully
  // Disable FK checks
  await c.query('SET FOREIGN_KEY_CHECKS = 0');

  for (const fix of fixes) {
    console.log(`\n=== Processing ${fix.table}.${fix.col} ===`);

    try {
      // 1. Get current CREATE TABLE
      const [createResult] = await c.query(`SHOW CREATE TABLE \`${fix.table}\``);
      let createSQL = createResult[0]['Create Table'];

      // 2. Backup data
      const [rows] = await c.query(`SELECT * FROM \`${fix.table}\``);
      console.log(`  Backed up ${rows.length} rows`);

      // 3. Drop table
      await c.query(`DROP TABLE \`${fix.table}\``);
      console.log(`  Dropped table`);

      // 4. Modify CREATE TABLE to add AUTO_INCREMENT to the column
      // Find the column definition line and add AUTO_INCREMENT
      // The column line looks like: `transaction_id` int(11) NOT NULL,
      // We need to make it: `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
      const colRegex = new RegExp(
        '(`' + fix.col + '`\\s+int(?:\\(\\d+\\))?\\s+NOT NULL)',
        'i'
      );
      let newCreateSQL = createSQL.replace(colRegex, '$1 AUTO_INCREMENT');

      // Also add AUTO_INCREMENT=nextId at the end
      if (fix.nextId > 1) {
        newCreateSQL = newCreateSQL.replace(
          /\)\s*(ENGINE=|COLLATE)/i,
          `) AUTO_INCREMENT=${fix.nextId} $1`
        );
      }

      // Execute new CREATE TABLE
      await c.query(newCreateSQL);
      console.log(`  Recreated table with AUTO_INCREMENT`);

      // 5. Re-insert data
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const placeholders = cols.map(() => '?').join(',');
        const colNames = cols.map(c => `\`${c}\``).join(',');

        for (const row of rows) {
          const values = cols.map(c => row[c]);
          await c.query(
            `INSERT INTO \`${fix.table}\` (${colNames}) VALUES (${placeholders})`,
            values
          );
        }
        console.log(`  Restored ${rows.length} rows`);
      }

      // 6. Set AUTO_INCREMENT value
      if (fix.nextId > 1) {
        await c.query(`ALTER TABLE \`${fix.table}\` AUTO_INCREMENT = ${fix.nextId}`);
      }

      // 7. Verify
      const [verifyCols] = await c.query(`SHOW COLUMNS FROM \`${fix.table}\` WHERE Field = ?`, [fix.col]);
      const hasAI = verifyCols[0].Extra.includes('auto_increment');
      console.log(`  Verification: AUTO_INCREMENT = ${hasAI ? '✅' : '❌'}`);

    } catch (e) {
      console.error(`  ❌ ERROR: ${e.message}`);
    }
  }

  await c.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n\n=== FINAL VERIFICATION ===\n');
  for (const fix of fixes) {
    try {
      const [cols] = await c.query(`SHOW COLUMNS FROM \`${fix.table}\` WHERE Field = ?`, [fix.col]);
      const hasAI = cols[0].Extra.includes('auto_increment');
      console.log(`${hasAI ? '✅' : '❌'} ${fix.table}.${fix.col}`);
    } catch(e) {
      console.log(`❌ ${fix.table}.${fix.col}: ${e.message.substring(0, 50)}`);
    }
  }

  await c.end();
  console.log('\nDone!');
})();
