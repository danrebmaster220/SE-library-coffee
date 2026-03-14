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

  // Tables that need AUTO_INCREMENT added (column must be in CREATE TABLE definition)
  const fixes = [
    { table: 'transactions', col: 'transaction_id' },
    { table: 'transaction_items', col: 'transaction_item_id' },
    { table: 'transaction_item_customizations', col: 'id' },
    { table: 'items', col: 'item_id' },
    { table: 'orders', col: 'order_id' },
    { table: 'order_items', col: 'order_item_id' },
    { table: 'order_item_addons', col: 'id' },
    { table: 'order_item_customizations', col: 'id' },
    { table: 'users', col: 'user_id' },
    { table: 'void_log', col: 'void_id' },
    { table: 'addons', col: 'addon_id' },
  ];

  for (const fix of fixes) {
    // Get CREATE TABLE statement
    const [createResult] = await c.query(`SHOW CREATE TABLE \`${fix.table}\``);
    let createSQL = createResult[0]['Create Table'];
    console.log(`\n=== ${fix.table} ===`);
    // Check if it already has AUTO_INCREMENT
    if (createSQL.toLowerCase().includes('auto_increment')) {
      console.log('Already has AUTO_INCREMENT, skipping');
      continue;
    }
    // Get row count
    const [countResult] = await c.query(`SELECT COUNT(*) as cnt FROM \`${fix.table}\``);
    const [maxResult] = await c.query(`SELECT COALESCE(MAX(\`${fix.col}\`), 0) as maxId FROM \`${fix.table}\``);
    console.log(`Rows: ${countResult[0].cnt}, Max ${fix.col}: ${maxResult[0].maxId}`);
  }

  await c.end();
})();
