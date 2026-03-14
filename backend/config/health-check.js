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

  // Clean up test order (transaction 52)
  await c.query('SET FOREIGN_KEY_CHECKS = 0');
  await c.query('DELETE FROM transaction_items WHERE transaction_id = 52');
  await c.query('DELETE FROM transactions WHERE transaction_id = 52');
  await c.query('UPDATE beepers SET status = ?, transaction_id = NULL, assigned_at = NULL WHERE beeper_number = 1', ['available']);
  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('✅ Test order 52 cleaned up, beeper 1 released\n');

  // Full system health check
  console.log('=== SYSTEM HEALTH CHECK ===\n');
  
  const checks = [
    ['categories', 12],
    ['items', 8],
    ['beepers', 20],
    ['users', 2],
    ['roles', 2],
    ['transactions', 50],
    ['transaction_items', 50],
    ['transaction_item_customizations', 135],
    ['customization_groups', 8],
    ['customization_options', 21],
    ['item_customization_groups', 59],
    ['discounts', 2],
    ['library_tables', 3],
    ['library_seats', 24],
    ['library_sessions', 17],
    ['quick_cash_amounts', 6],
    ['void_log', 2],
  ];

  let allOk = true;
  for (const [table, expected] of checks) {
    const [cnt] = await c.query(`SELECT COUNT(*) as c FROM \`${table}\``);
    const ok = cnt[0].c === expected;
    if (!ok) allOk = false;
    console.log(`${ok ? '✅' : '❌'} ${table}: ${cnt[0].c}${ok ? '' : ` (expected ${expected})`}`);
  }

  // Check available beepers
  const [beepers] = await c.query("SELECT COUNT(*) as c FROM beepers WHERE status = 'available'");
  console.log(`\n🔔 Available beepers: ${beepers[0].c}/20`);

  // Check AUTO_INCREMENT on critical tables
  console.log('\n=== AUTO_INCREMENT Status ===');
  const aiTables = ['transactions', 'transaction_items', 'transaction_item_customizations', 'items', 'users'];
  for (const t of aiTables) {
    const [cols] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    const pk = cols.find(c => c.Key === 'PRI');
    const hasAI = pk?.Extra.includes('auto_increment');
    console.log(`${hasAI ? '✅' : '❌'} ${t}.${pk.Field}`);
  }

  console.log(allOk ? '\n🎉 ALL CHECKS PASSED!' : '\n⚠️ Some checks failed');
  
  await c.end();
})();
