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

  // Tables that need AUTO_INCREMENT added (existing tables with data)
  const tables = [
    {
      name: 'roles',
      col: 'role_id',
      nextId: 4,
      create: `CREATE TABLE roles (
        role_id int NOT NULL AUTO_INCREMENT,
        name varchar(20) NOT NULL,
        PRIMARY KEY (role_id),
        UNIQUE KEY name (name)
      ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'categories',
      col: 'category_id',
      nextId: 13,
      create: `CREATE TABLE categories (
        category_id int NOT NULL AUTO_INCREMENT,
        name varchar(50) NOT NULL,
        status enum('active','inactive') DEFAULT 'active',
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (category_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'customization_groups',
      col: 'group_id',
      nextId: 9,
      create: `CREATE TABLE customization_groups (
        group_id int NOT NULL AUTO_INCREMENT,
        name varchar(50) NOT NULL,
        display_name varchar(100) DEFAULT NULL,
        type enum('radio','checkbox') DEFAULT 'radio',
        is_required tinyint(1) DEFAULT 0,
        sort_order int DEFAULT 0,
        PRIMARY KEY (group_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'customization_options',
      col: 'option_id',
      nextId: 22,
      create: `CREATE TABLE customization_options (
        option_id int NOT NULL AUTO_INCREMENT,
        group_id int NOT NULL,
        name varchar(50) NOT NULL,
        price_modifier decimal(10,2) DEFAULT 0.00,
        is_default tinyint(1) DEFAULT 0,
        sort_order int DEFAULT 0,
        PRIMARY KEY (option_id),
        KEY group_id (group_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'discounts',
      col: 'discount_id',
      nextId: 3,
      create: `CREATE TABLE discounts (
        discount_id int NOT NULL AUTO_INCREMENT,
        name varchar(50) NOT NULL,
        type enum('percentage','fixed') NOT NULL,
        value decimal(10,2) NOT NULL,
        status enum('active','inactive') DEFAULT 'active',
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (discount_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'item_customization_groups',
      col: 'id',
      nextId: 124,
      create: `CREATE TABLE item_customization_groups (
        id int NOT NULL AUTO_INCREMENT,
        item_id int NOT NULL,
        group_id int NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY unique_item_group (item_id, group_id),
        KEY group_id (group_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'library_tables',
      col: 'table_id',
      nextId: 4,
      create: `CREATE TABLE library_tables (
        table_id int NOT NULL AUTO_INCREMENT,
        table_number int NOT NULL,
        seats int NOT NULL DEFAULT 8,
        status enum('active','inactive') DEFAULT 'active',
        PRIMARY KEY (table_id),
        UNIQUE KEY table_number (table_number)
      ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'library_seats',
      col: 'seat_id',
      nextId: 25,
      create: `CREATE TABLE library_seats (
        seat_id int NOT NULL AUTO_INCREMENT,
        table_id int NOT NULL,
        seat_number int NOT NULL,
        status enum('available','occupied','reserved') DEFAULT 'available',
        PRIMARY KEY (seat_id),
        UNIQUE KEY unique_table_seat (table_id, seat_number),
        KEY table_id (table_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'library_sessions',
      col: 'session_id',
      nextId: 18,
      create: `CREATE TABLE library_sessions (
        session_id int NOT NULL AUTO_INCREMENT,
        seat_id int NOT NULL,
        customer_name varchar(100) DEFAULT NULL,
        start_time datetime NOT NULL,
        end_time datetime DEFAULT NULL,
        total_minutes int DEFAULT NULL,
        amount_due decimal(10,2) DEFAULT NULL,
        status enum('active','completed','voided') DEFAULT 'active',
        paid_minutes int DEFAULT NULL,
        amount_paid decimal(10,2) DEFAULT NULL,
        cash_tendered decimal(10,2) DEFAULT NULL,
        change_due decimal(10,2) DEFAULT NULL,
        voided_at datetime DEFAULT NULL,
        voided_by int DEFAULT NULL,
        void_reason text DEFAULT NULL,
        PRIMARY KEY (session_id),
        KEY seat_id (seat_id)
      ) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    },
    {
      name: 'quick_cash_amounts',
      col: 'id',
      nextId: 7,
      create: `CREATE TABLE quick_cash_amounts (
        id int NOT NULL AUTO_INCREMENT,
        amount decimal(10,2) NOT NULL,
        sort_order int DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    }
  ];

  for (const t of tables) {
    console.log(`\n=== ${t.name} ===`);
    
    // 1. Backup data
    const [rows] = await c.query(`SELECT * FROM \`${t.name}\``);
    console.log(`  Backed up ${rows.length} rows`);

    // 2. Drop
    await c.query(`DROP TABLE \`${t.name}\``);

    // 3. Create with AUTO_INCREMENT
    await c.query(t.create);
    console.log(`  Created with AUTO_INCREMENT`);

    // 4. Restore data
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

    // 5. Verify
    const [verCols] = await c.query(`SHOW COLUMNS FROM \`${t.name}\` WHERE Field = ?`, [t.col]);
    console.log(`  AUTO_INCREMENT: ${verCols[0].Extra.includes('auto_increment') ? '✅' : '❌'}`);
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
      console.log(`${hasAI ? '✅' : '❌'} ${t}.${pk.Field}`);
    }
  }

  console.log(allOk ? '\n🎉 ALL TABLES HAVE AUTO_INCREMENT!' : '\n⚠️ Some tables still missing AUTO_INCREMENT');

  await c.end();
})();
