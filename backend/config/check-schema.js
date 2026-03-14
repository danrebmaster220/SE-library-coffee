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
  
  console.log('=== TRANSACTIONS TABLE ===');
  const [cols] = await c.query('DESCRIBE transactions');
  cols.forEach(x => console.log(`  ${x.Field} | ${x.Type} | ${x.Null} | ${x.Default}`));

  console.log('\n=== TRANSACTION_ITEMS TABLE ===');
  const [cols2] = await c.query('DESCRIBE transaction_items');
  cols2.forEach(x => console.log(`  ${x.Field} | ${x.Type} | ${x.Null} | ${x.Default}`));

  console.log('\n=== TRANSACTION_ITEM_CUSTOMIZATIONS TABLE ===');
  const [cols3] = await c.query('DESCRIBE transaction_item_customizations');
  cols3.forEach(x => console.log(`  ${x.Field} | ${x.Type} | ${x.Null} | ${x.Default}`));

  // Check if order_number column has auto-generation
  console.log('\n=== Sample transaction ===');
  const [tx] = await c.query('SELECT * FROM transactions LIMIT 1');
  console.log(tx[0]);

  console.log('\n=== Available beepers ===');
  const [beepers] = await c.query("SELECT beeper_number, status FROM beepers WHERE status='available' LIMIT 5");
  console.log(beepers);

  console.log('\n=== Beeper counts ===');
  const [bc] = await c.query("SELECT status, COUNT(*) as cnt FROM beepers GROUP BY status");
  console.log(bc);

  await c.end();
})();
