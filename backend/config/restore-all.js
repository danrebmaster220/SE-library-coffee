const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

  // =====================================================
  // Step 1: Drop and recreate the 6 tables that were lost
  // =====================================================
  
  // Drop if they partially exist
  const dropTables = ['void_log', 'transaction_item_customizations', 'transaction_items', 'transactions', 'items', 'users'];
  for (const t of dropTables) {
    await c.query(`DROP TABLE IF EXISTS \`${t}\``);
    console.log(`Dropped ${t}`);
  }

  // Recreate with proper schema + AUTO_INCREMENT
  // users
  await c.query(`
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
  `);
  console.log('✅ Created users');

  // items
  await c.query(`
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
  `);
  console.log('✅ Created items');

  // transactions - matching original schema with order_number
  await c.query(`
    CREATE TABLE transactions (
      transaction_id int NOT NULL AUTO_INCREMENT,
      order_number varchar(20) DEFAULT NULL,
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
      status enum('pending','paid','preparing','ready','completed','voided','refunded') NOT NULL DEFAULT 'pending',
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
  `);
  console.log('✅ Created transactions');

  // transaction_items
  await c.query(`
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
  `);
  console.log('✅ Created transaction_items');

  // transaction_item_customizations
  await c.query(`
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
  `);
  console.log('✅ Created transaction_item_customizations');

  // void_log
  await c.query(`
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
  `);
  console.log('✅ Created void_log');

  // =====================================================
  // Step 2: Restore data — read from original SQL file
  // =====================================================
  const sqlFile = fs.readFileSync(path.join(__dirname, 'coffee_database.sql'), 'utf8');

  // --- users data ---
  console.log('\n--- Inserting users ---');
  await c.query(`
    INSERT INTO users (user_id, role_id, full_name, username, password_hash, status, created_at) VALUES
    (4, 1, 'Admin User', 'admin', '$2a$10$xPPPGj1GGxJj9O5FMnSLvuCz/KnHMjUdXuBRG1GnfvNgroqpDrEYu', 'active', '2025-11-28 17:22:23'),
    (5, 2, 'Staff User', 'staff', '$2a$10$xPPPGj1GGxJj9O5FMnSLvuCz/KnHMjUdXuBRG1GnfvNgroqpDrEYu', 'active', '2025-11-28 17:22:23')
  `);
  console.log('✅ Users inserted');

  // --- items data (without images first, we'll add images after) ---
  console.log('\n--- Inserting items ---');
  await c.query(`
    INSERT INTO items (item_id, category_id, name, description, price, station, status, created_at, is_customizable) VALUES
    (2, 1, 'Americano', NULL, 150.00, 'barista', 'available', '2025-11-28 22:34:29', 1),
    (3, 2, 'MatchaLatte', NULL, 200.00, 'barista', 'available', '2025-11-28 22:38:48', 1),
    (5, 1, 'Cappuccino', NULL, 200.00, 'barista', 'available', '2025-11-30 15:22:45', 1),
    (6, 5, 'MatchaFrap', NULL, 250.00, 'barista', 'available', '2025-11-30 15:59:06', 1),
    (8, 4, 'CarbonNara', NULL, 200.00, 'kitchen', 'available', '2025-12-01 15:50:29', 0),
    (9, 3, 'Chocolate', NULL, 150.00, 'barista', 'available', '2025-12-01 15:52:16', 1),
    (11, 2, 'MatchaLover', NULL, 250.00, 'barista', 'available', '2025-12-01 16:08:29', 1),
    (14, 3, 'StrawBerryMilk', NULL, 150.00, 'barista', 'available', '2025-12-03 11:27:44', 1)
  `);
  console.log('✅ Items inserted (images will be restored separately)');

  // --- transactions data ---
  // We need to fix: empty '' order_type -> 'dine-in'
  console.log('\n--- Inserting transactions ---');

  // Read the transactions INSERT from SQL file
  const txStart = sqlFile.indexOf("INSERT INTO `transactions`");
  const txEnd = sqlFile.indexOf(";", txStart) + 1;
  let txSQL = sqlFile.substring(txStart, txEnd);
  
  // Fix empty strings in order_type: replace '' (empty) with 'dine-in'
  // In the data, empty order_type appears as , '', which should be , 'dine-in',
  // Let's use parameterized inserts to avoid all these issues
  
  // Parse transaction data manually and insert row by row
  const txData = [
    [1, 'ORD-000001', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2025-11-29 00:47:08', null, null, null, null, '2025-11-29 00:47:08', '2025-11-29 00:47:23'],
    [2, 'ORD-000002', 1, 'dine-in', 150.00, 1, 30.00, null, null, 120.00, 1000.00, 880.00, 'completed', '2025-11-29 00:57:15', null, null, null, null, '2025-11-29 00:57:15', '2025-11-29 00:58:03'],
    [3, 'ORD-000003', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 1000.00, 850.00, 'completed', '2025-11-29 00:59:09', null, null, null, null, '2025-11-29 00:59:09', '2025-11-29 00:59:34'],
    [4, 'ORD-000004', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 1000.00, 850.00, 'completed', '2025-11-29 01:03:02', null, null, null, null, '2025-11-29 01:03:02', '2025-11-29 01:03:50'],
    [5, 'ORD-000005', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 1000.00, 850.00, 'completed', '2025-11-29 01:04:04', null, null, null, null, '2025-11-29 01:04:04', '2025-11-29 01:04:23'],
    [6, 'ORD-000006', 2, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 1000.00, 850.00, 'completed', '2025-11-29 01:04:08', null, null, null, null, '2025-11-29 01:04:08', '2025-11-29 01:04:16'],
    [7, 'ORD-000007', 1, 'takeout', 150.00, null, 0.00, null, null, 168.00, 200.00, 32.00, 'completed', '2025-11-29 12:57:10', null, null, null, null, '2025-11-29 12:57:10', '2025-11-29 12:57:23'],
    [8, 'ORD-000008', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2025-11-30 00:43:18', null, null, null, null, '2025-11-30 00:43:18', '2025-11-30 00:55:32'],
    [9, 'ORD-000009', 1, 'takeout', 150.00, null, 0.00, null, null, 150.00, null, null, 'completed', null, null, null, null, null, '2025-11-30 02:06:56', '2025-11-30 02:07:29'],
    [10, 'ORD-000010', 1, 'takeout', 212.00, null, 0.00, null, null, 212.00, 500.00, 288.00, 'completed', '2025-11-30 15:23:06', null, null, null, null, '2025-11-30 12:52:43', '2025-11-30 15:23:14'],
    [11, 'ORD-000011', 1, 'dine-in', 150.00, 1, 30.00, null, null, 120.00, 500.00, 380.00, 'completed', '2025-11-30 15:24:27', null, null, null, null, '2025-11-30 15:24:27', '2025-11-30 15:39:41'],
    [12, 'ORD-000012', 2, 'dine-in', 192.00, null, 0.00, null, null, 192.00, 500.00, 308.00, 'completed', '2025-11-30 15:31:36', null, null, null, null, '2025-11-30 15:30:39', '2025-11-30 15:39:46'],
    [13, 'ORD-000013', 3, 'takeout', 185.00, null, 0.00, null, null, 185.00, 500.00, 315.00, 'voided', '2025-11-30 15:39:06', null, null, 'Voided by staff', '2025-11-30 15:52:49', '2025-11-30 15:31:11', null],
    [14, 'ORD-000014', 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2025-11-30 18:29:36', null, null, null, null, '2025-11-30 18:29:36', '2025-11-30 18:31:00'],
    [15, 'ORD-000015', 1, 'dine-in', 150.00, 2, 18.00, null, null, 132.00, 500.00, 368.00, 'completed', '2025-11-30 22:28:09', null, null, null, null, '2025-11-30 22:28:09', '2025-11-30 22:30:42'],
    [16, 'ORD-000016', 1, 'dine-in', 235.00, null, 0.00, null, null, 235.00, 500.00, 265.00, 'completed', '2025-11-30 22:54:48', null, null, null, null, '2025-11-30 22:54:21', '2025-11-30 23:34:14'],
    [17, 'ORD-000017', 1, 'takeout', 222.00, 2, 26.64, null, null, 195.36, 1000.00, 804.64, 'completed', '2025-12-01 15:53:27', null, null, null, null, '2025-12-01 15:53:12', '2025-12-01 15:53:35'],
    [18, 'ORD-000018', 1, 'dine-in', 327.00, null, 0.00, null, null, 327.00, 1000.00, 673.00, 'voided', '2025-12-01 16:38:13', null, null, 'Customer want refund', '2025-12-01 16:48:32', '2025-12-01 16:38:13', null],
    [19, 'ORD-000019', 3, 'dine-in', 369.00, 1, 73.80, null, null, 295.20, 1000.00, 704.80, 'completed', '2025-12-01 16:58:31', null, null, null, null, '2025-12-01 16:58:31', '2025-12-01 16:58:36'],
    [20, 'ORD-000020', 1, 'dine-in', 288.00, null, 0.00, null, null, 288.00, 500.00, 212.00, 'completed', '2025-12-01 17:02:23', null, null, null, null, '2025-12-01 16:59:20', '2025-12-01 17:03:14'],
    [21, 'ORD-000021', 2, 'dine-in', 328.00, null, 0.00, null, null, 328.00, null, null, 'voided', null, null, null, 'Customer have emergency', '2025-12-01 17:02:51', '2025-12-01 17:00:36', null],
    [22, 'ORD-000022', 3, 'dine-in', 263.00, null, 0.00, null, null, 263.00, null, null, 'voided', null, null, null, 'Testing', '2025-12-01 17:03:12', '2025-12-01 17:01:39', null],
    [23, 'ORD-000023', 1, 'dine-in', 476.00, 1, 95.20, null, null, 380.80, 1000.00, 619.20, 'completed', '2025-12-01 17:11:41', null, null, null, null, '2025-12-01 17:11:41', '2025-12-01 17:12:15'],
    [24, 'ORD-000024', 2, 'dine-in', 159.00, null, 0.00, null, null, 159.00, 500.00, 341.00, 'completed', '2025-12-01 17:15:55', null, null, null, null, '2025-12-01 17:15:55', '2025-12-01 17:16:04'],
    [25, 'ORD-000025', 1, 'dine-in', 159.00, null, 0.00, null, null, 159.00, 500.00, 341.00, 'completed', '2025-12-01 17:19:34', null, null, null, null, '2025-12-01 17:19:34', '2025-12-01 17:19:59'],
    [26, 'ORD-000026', 14, 'dine-in', 200.00, null, 0.00, null, null, 200.00, 500.00, 300.00, 'completed', '2025-12-01 17:20:58', null, null, null, null, '2025-12-01 17:20:58', '2025-12-01 17:21:23'],
    [27, null, 2, 'dine-in', 307.00, 1, 61.40, null, null, 245.60, 500.00, 254.40, 'voided', '2025-12-01 17:50:02', null, 5, 'Customer Refund', '2025-12-01 17:50:27', '2025-12-01 17:50:02', null],
    [28, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 200.00, 50.00, 'completed', '2025-12-01 21:29:52', null, null, null, null, '2025-12-01 21:29:52', '2025-12-01 21:30:09'],
    [29, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2025-12-01 21:30:36', null, null, null, null, '2025-12-01 21:30:36', '2025-12-01 21:31:44'],
    [30, null, 9, 'dine-in', 250.00, null, 0.00, null, null, 250.00, 500.00, 250.00, 'completed', '2025-12-01 21:38:44', 5, null, null, null, '2025-12-01 21:38:44', '2025-12-01 21:38:48'],
    [31, null, 1, 'dine-in', 322.00, null, 0.00, null, null, 322.00, 1000.00, 678.00, 'completed', '2025-12-01 21:57:31', null, null, null, null, '2025-12-01 21:57:16', '2025-12-01 21:57:39'],
    [32, null, 4, 'dine-in', 250.00, null, 0.00, null, null, 250.00, 500.00, 250.00, 'completed', '2025-12-03 11:28:48', 5, null, null, null, '2025-12-03 11:28:48', '2025-12-03 11:28:51'],
    [33, null, 1, 'dine-in', 225.00, null, 0.00, null, null, 225.00, 500.00, 275.00, 'completed', '2025-12-03 11:34:13', null, null, null, null, '2025-12-03 11:34:07', '2025-12-03 11:34:15'],
    [34, null, 1, 'dine-in', 25.00, null, 0.00, null, null, 25.00, 100.00, 75.00, 'completed', '2025-12-03 11:42:00', 5, null, null, null, '2025-12-03 11:41:53', '2025-12-03 11:42:02'],
    [35, null, 1, 'dine-in', 150.00, null, 0.00, '{"seat_id":1,"table_number":1,"seat_number":1,"customer_name":"Alshaik Hassan","duration_minutes":120,"amount":100}', 13, 250.00, 1000.00, 750.00, 'completed', '2025-12-04 03:14:37', 4, null, null, null, '2025-12-04 03:13:06', '2025-12-04 03:14:50'],
    [36, null, 1, 'dine-in', 0.00, null, 0.00, '{"seat_id":2,"table_number":1,"seat_number":2,"customer_name":"Adian Alfahad","duration_minutes":120,"amount":100}', null, 100.00, null, null, 'voided', null, null, 4, 'error input', '2025-12-04 03:30:59', '2025-12-04 03:30:41', null],
    [37, null, 1, 'dine-in', 0.00, null, 0.00, '{"seat_id":2,"table_number":1,"seat_number":2,"customer_name":"Adian Alfahad","duration_minutes":120,"amount":100}', null, 100.00, 500.00, 400.00, 'completed', '2025-12-04 03:48:13', 4, null, null, null, '2025-12-04 03:39:42', '2025-12-04 03:48:15'],
    [38, null, 1, 'dine-in', 220.00, null, 0.00, '{"seat_id":9,"table_number":2,"seat_number":1,"customer_name":"Marian Talaid","duration_minutes":120,"amount":100}', null, 320.00, 500.00, 180.00, 'completed', '2025-12-04 04:13:40', 4, null, null, null, '2025-12-04 04:13:19', '2025-12-04 04:13:42'],
    [39, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 700.00, 550.00, 'completed', '2026-01-19 19:18:18', 4, null, null, null, '2026-01-19 19:18:18', '2026-01-19 19:19:36'],
    [40, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2026-01-19 19:53:51', 4, null, null, null, '2026-01-19 19:23:51', '2026-01-19 20:42:44'],
    [41, null, 4, 'dine-in', 200.00, null, 0.00, null, null, 200.00, 200.00, 0.00, 'completed', '2026-01-19 19:54:50', 4, null, null, null, '2026-01-19 19:54:50', '2026-01-19 20:42:45'],
    [42, null, 2, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 200.00, 50.00, 'completed', '2026-01-19 20:42:37', 4, null, null, null, '2026-01-19 19:55:06', '2026-01-19 20:42:45'],
    [43, null, 3, 'dine-in', 250.00, null, 0.00, null, null, 250.00, 500.00, 250.00, 'completed', '2026-01-19 20:42:41', 4, null, null, null, '2026-01-19 20:24:17', '2026-01-19 20:42:45'],
    [44, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2026-01-26 07:34:55', 4, null, null, null, '2026-01-26 07:34:55', '2026-01-26 10:30:41'],
    [45, null, 10, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2026-01-26 08:01:36', 4, null, null, null, '2026-01-26 08:01:36', '2026-01-26 10:30:41'],
    [46, null, 2, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2026-01-26 10:30:37', 4, null, null, null, '2026-01-26 08:39:36', '2026-01-26 10:30:41'],
    [47, null, 3, 'dine-in', 200.00, null, 0.00, null, null, 200.00, 1000.00, 800.00, 'completed', '2026-01-26 10:30:45', 4, null, null, null, '2026-01-26 09:11:09', '2026-01-26 10:30:48'],
    [48, null, 1, 'dine-in', 150.00, null, 0.00, null, null, 150.00, 500.00, 350.00, 'completed', '2026-02-10 17:12:25', 4, null, null, null, '2026-02-02 11:37:07', '2026-02-10 17:12:28'],
    [49, null, 1, 'dine-in', 270.00, null, 0.00, '{"seat_id":10,"table_number":2,"seat_number":2,"customer_name":"Alshaik Hassan","duration_minutes":120,"amount":100}', null, 370.00, 500.00, 130.00, 'completed', '2026-02-13 10:18:01', 4, null, null, null, '2026-02-13 09:34:27', '2026-02-13 10:18:04'],
    [50, null, 2, 'dine-in', 170.00, null, 0.00, null, null, 170.00, 1000.00, 830.00, 'completed', '2026-02-13 10:18:07', 4, null, null, null, '2026-02-13 10:17:55', '2026-02-13 10:18:09'],
  ];

  const txInsertSQL = `INSERT INTO transactions (transaction_id, order_number, beeper_number, order_type, subtotal, discount_id, discount_amount, library_booking, library_session_id, total_amount, cash_tendered, change_due, status, paid_at, processed_by, voided_by, void_reason, voided_at, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  let txCount = 0;
  for (const row of txData) {
    await c.query(txInsertSQL, row);
    txCount++;
  }
  console.log(`✅ Inserted ${txCount} transactions`);

  // --- transaction_items data ---
  console.log('\n--- Inserting transaction_items ---');
  // Read from SQL file
  const tiStart = sqlFile.indexOf("INSERT INTO `transaction_items`");
  if (tiStart === -1) {
    console.log('❌ Could not find transaction_items INSERT in SQL file');
  } else {
    const tiEnd = sqlFile.indexOf(";", tiStart) + 1;
    let tiSQL = sqlFile.substring(tiStart, tiEnd);
    // Remove backticks for TiDB compatibility
    tiSQL = tiSQL.replace(/`/g, '');
    await c.query(tiSQL);
    console.log('✅ transaction_items inserted');
  }

  // --- transaction_item_customizations data ---
  console.log('\n--- Inserting transaction_item_customizations ---');
  const ticStart = sqlFile.indexOf("INSERT INTO `transaction_item_customizations`");
  if (ticStart === -1) {
    console.log('❌ Could not find transaction_item_customizations INSERT in SQL file');
  } else {
    const ticEnd = sqlFile.indexOf(";", ticStart) + 1;
    let ticSQL = sqlFile.substring(ticStart, ticEnd);
    ticSQL = ticSQL.replace(/`/g, '');
    await c.query(ticSQL);
    console.log('✅ transaction_item_customizations inserted');
  }

  // --- void_log data ---
  console.log('\n--- Inserting void_log ---');
  const vlStart = sqlFile.indexOf("INSERT INTO `void_log`");
  if (vlStart === -1) {
    console.log('❌ Could not find void_log INSERT in SQL file');
  } else {
    const vlEnd = sqlFile.indexOf(";", vlStart) + 1;
    let vlSQL = sqlFile.substring(vlStart, vlEnd);
    vlSQL = vlSQL.replace(/`/g, '');
    await c.query(vlSQL);
    console.log('✅ void_log inserted');
  }

  await c.query('SET FOREIGN_KEY_CHECKS = 1');

  // =====================================================
  // Step 3: Verify all data
  // =====================================================
  console.log('\n=== VERIFICATION ===');
  const checkTables = ['users', 'items', 'transactions', 'transaction_items', 'transaction_item_customizations', 'void_log'];
  for (const t of checkTables) {
    const [cnt] = await c.query(`SELECT COUNT(*) as c FROM \`${t}\``);
    const [cols] = await c.query(`SHOW COLUMNS FROM \`${t}\``);
    const pk = cols.find(c => c.Key === 'PRI');
    const hasAI = pk ? pk.Extra.includes('auto_increment') : false;
    console.log(`${hasAI ? '✅' : '❌'} ${t}: ${cnt[0].c} rows, AUTO_INCREMENT=${hasAI}`);
  }

  await c.end();
  console.log('\nDone! Now restore images with update-images.js');
})();
