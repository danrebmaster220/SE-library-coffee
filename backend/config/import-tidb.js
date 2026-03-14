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

async function importChunk(conn, filePath, label) {
  console.log(`\n📦 Importing ${label}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  try {
    await conn.query(sql);
    console.log(`✅ ${label} imported successfully`);
  } catch (e) {
    console.log(`⚠️  ${label} error: ${e.message}`);
    // Try statement by statement
    console.log('   Trying statement by statement...');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 5);
    let ok = 0, fail = 0;
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
        ok++;
      } catch (e2) {
        fail++;
        if (!e2.message.includes('Duplicate') && !e2.message.includes('already exists')) {
          console.log(`   ❌ ${e2.message.substring(0, 100)}`);
        }
      }
    }
    console.log(`   Done: ${ok} OK, ${fail} failed`);
  }
}

(async () => {
  const conn = await mysql.createConnection(CONFIG);
  console.log('🔗 Connected to TiDB Cloud!');

  const configDir = __dirname;

  // Import in order
  await importChunk(conn, path.join(configDir, 'chunk1_create.sql'), 'CREATE TABLES');
  await importChunk(conn, path.join(configDir, 'chunk2_inserts.sql'), 'INSERT DATA');
  await importChunk(conn, path.join(configDir, 'chunk3_items.sql'), 'INSERT ITEMS');
  await importChunk(conn, path.join(configDir, 'chunk4_alters.sql'), 'ALTER TABLES');

  // Verify
  console.log('\n📊 Verifying tables...');
  const [tables] = await conn.query('SHOW TABLES');
  console.log(`Total tables: ${tables.length}`);
  
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [count] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    console.log(`  ${tableName}: ${count[0].cnt} rows`);
  }

  await conn.end();
  console.log('\n✅ Import complete!');
})();
