const mysql = require('mysql2/promise');
const CONFIG = {
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: 'zuSFWPhNSUnf7Cu.root',
  password: 'Iwwb1dWcJZZrknRy',
  database: 'test',
  ssl: { rejectUnauthorized: false }
};

// The 6 tables that were dropped and need to be recreated from scratch.
// We define them with AUTO_INCREMENT already in the column definition.
// ORDER MATTERS: create tables that others reference FIRST.

const CREATE_USERS = `
CREATE TABLE users (
  user_id int NOT NULL AUTO_INCREMENT,
  role_id int DEFAULT NULL,
  full_name varchar(100) NOT NULL,
  username varchar(50) NOT NULL,
  password_hash varchar(255) NOT NULL,
  status enum('active','inactive') DEFAULT 'active',
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY username (username),
  KEY role_id (role_id)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const CREATE_ITEMS = `
CREATE TABLE items (
  item_id int NOT NULL AUTO_INCREMENT,
  category_id int NOT NULL,
  name varchar(100) NOT NULL,
  description text DEFAULT NULL,
  price decimal(10,2) NOT NULL,
  station enum('barista','kitchen') NOT NULL,
  status enum('available','sold_out') DEFAULT 'available',
  image longtext DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  is_customizable tinyint(1) DEFAULT 0,
  PRIMARY KEY (item_id),
  KEY category_id (category_id)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const CREATE_TRANSACTIONS = `
CREATE TABLE transactions (
  transaction_id int NOT NULL AUTO_INCREMENT,
  customer_name varchar(100) DEFAULT NULL,
  beeper_number int NOT NULL,
  order_type enum('dine-in','takeout') DEFAULT 'dine-in',
  subtotal decimal(10,2) NOT NULL,
  discount_id int DEFAULT NULL,
  discount_amount decimal(10,2) DEFAULT 0.00,
  library_booking longtext DEFAULT NULL,
  library_session_id int DEFAULT NULL,
  total_amount decimal(10,2) NOT NULL,
  cash_tendered decimal(10,2) DEFAULT NULL,
  change_due decimal(10,2) DEFAULT NULL,
  status enum('pending','preparing','ready','completed','voided','refunded') NOT NULL DEFAULT 'pending',
  paid_at datetime DEFAULT NULL,
  processed_by int DEFAULT NULL,
  voided_by int DEFAULT NULL,
  void_reason text DEFAULT NULL,
  voided_at datetime DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  completed_at datetime DEFAULT NULL,
  PRIMARY KEY (transaction_id),
  KEY discount_id (discount_id),
  KEY processed_by (processed_by),
  KEY voided_by (voided_by),
  KEY fk_library_session (library_session_id)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const CREATE_TRANSACTION_ITEMS = `
CREATE TABLE transaction_items (
  transaction_item_id int NOT NULL AUTO_INCREMENT,
  transaction_id int NOT NULL,
  item_id int NOT NULL,
  item_name varchar(100) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  notes text DEFAULT NULL,
  created_at datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transaction_item_id),
  KEY transaction_id (transaction_id),
  KEY item_id (item_id),
  CONSTRAINT transaction_items_ibfk_1 FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id) ON DELETE CASCADE,
  CONSTRAINT transaction_items_ibfk_2 FOREIGN KEY (item_id) REFERENCES items (item_id)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const CREATE_TRANSACTION_ITEM_CUSTOMIZATIONS = `
CREATE TABLE transaction_item_customizations (
  id int NOT NULL AUTO_INCREMENT,
  transaction_item_id int NOT NULL,
  option_id int DEFAULT NULL,
  option_name varchar(100) NOT NULL,
  group_name varchar(50) NOT NULL,
  quantity int DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY transaction_item_id (transaction_item_id),
  KEY option_id (option_id)
) ENGINE=InnoDB AUTO_INCREMENT=136 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

const CREATE_VOID_LOG = `
CREATE TABLE void_log (
  void_id int NOT NULL AUTO_INCREMENT,
  transaction_id int NOT NULL,
  voided_by int NOT NULL,
  void_reason text DEFAULT NULL,
  voided_at datetime DEFAULT CURRENT_TIMESTAMP,
  original_amount decimal(10,2) NOT NULL,
  void_type varchar(20) NOT NULL DEFAULT 'void',
  refund_amount decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (void_id),
  KEY transaction_id (transaction_id),
  KEY voided_by (voided_by),
  CONSTRAINT void_log_ibfk_1 FOREIGN KEY (transaction_id) REFERENCES transactions (transaction_id),
  CONSTRAINT void_log_ibfk_2 FOREIGN KEY (voided_by) REFERENCES users (user_id)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
`;

(async () => {
  const c = await mysql.createConnection(CONFIG);
  await c.query('SET FOREIGN_KEY_CHECKS = 0');

  // === Step 1: Create the 6 missing tables ===
  const tableDefs = [
    { name: 'users', sql: CREATE_USERS },
    { name: 'items', sql: CREATE_ITEMS },
    { name: 'transactions', sql: CREATE_TRANSACTIONS },
    { name: 'transaction_items', sql: CREATE_TRANSACTION_ITEMS },
    { name: 'transaction_item_customizations', sql: CREATE_TRANSACTION_ITEM_CUSTOMIZATIONS },
    { name: 'void_log', sql: CREATE_VOID_LOG },
  ];

  for (const td of tableDefs) {
    try {
      await c.query(td.sql);
      console.log(`✅ Created ${td.name}`);
    } catch (e) {
      console.log(`❌ Failed to create ${td.name}: ${e.message.substring(0, 100)}`);
    }
  }

  // === Step 2: Verify AUTO_INCREMENT on all tables ===
  console.log('\n=== Verifying AUTO_INCREMENT ===');
  for (const td of tableDefs) {
    try {
      const [cols] = await c.query(`SHOW COLUMNS FROM \`${td.name}\``);
      const pkCol = cols.find(c => c.Key === 'PRI');
      console.log(`${pkCol.Extra.includes('auto_increment') ? '✅' : '❌'} ${td.name}.${pkCol.Field}: ${pkCol.Extra}`);
    } catch(e) {
      console.log(`❌ ${td.name}: ${e.message.substring(0, 60)}`);
    }
  }

  await c.query('SET FOREIGN_KEY_CHECKS = 1');
  await c.end();
  console.log('\nDone! Tables created. Now need to restore data.');
})();
