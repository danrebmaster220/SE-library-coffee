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
  connectTimeout: 30000,
  multipleStatements: true
};

(async () => {
  const conn = await mysql.createConnection(CONFIG);
  console.log('Connected!');

  // Read the transactions INSERT from chunk2
  const chunk2 = fs.readFileSync(path.join(__dirname, 'chunk2_inserts.sql'), 'utf8');
  
  // Find the transactions INSERT statement
  const txMatch = chunk2.match(/INSERT INTO `transactions`[\s\S]*?;/);
  if (!txMatch) { console.log('No transactions INSERT found'); return; }
  
  let txSql = txMatch[0];
  // Replace empty order_type '' with 'dine-in'
  txSql = txSql.replace(/, '',/g, ", 'dine-in',");
  
  try {
    await conn.query('DELETE FROM transaction_item_customizations');
    await conn.query('DELETE FROM transaction_items');
    await conn.query('DELETE FROM void_log');
    await conn.query('DELETE FROM transactions');
    console.log('Cleared old transaction data');
    
    await conn.query(txSql);
    console.log('✅ Transactions inserted!');
    
    // Re-insert transaction_items
    const tiMatch = chunk2.match(/INSERT INTO `transaction_items`[\s\S]*?;/);
    if (tiMatch) {
      await conn.query(tiMatch[0]);
      console.log('✅ Transaction items inserted!');
    }
    
    // Re-insert transaction_item_customizations
    const ticMatch = chunk2.match(/INSERT INTO `transaction_item_customizations`[\s\S]*?;/);
    if (ticMatch) {
      await conn.query(ticMatch[0]);
      console.log('✅ Transaction item customizations inserted!');
    }
    
    // Re-insert void_log
    const vlMatch = chunk2.match(/INSERT INTO `void_log`[\s\S]*?;/);
    if (vlMatch) {
      await conn.query(vlMatch[0]);
      console.log('✅ Void log inserted!');
    }
    
  } catch(e) {
    console.log('ERROR:', e.message);
  }

  // Final count
  const [tx] = await conn.query('SELECT COUNT(*) as cnt FROM transactions');
  const [ti] = await conn.query('SELECT COUNT(*) as cnt FROM transaction_items');
  const [us] = await conn.query('SELECT COUNT(*) as cnt FROM users');
  console.log(`\nTransactions: ${tx[0].cnt}, Items: ${ti[0].cnt}, Users: ${us[0].cnt}`);
  
  await conn.end();
})();
