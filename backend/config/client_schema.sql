USE coffee_db;

-- =============================================
-- Clean Client Database Schema
-- Library Coffee System
-- Schema-only + essential seed data
-- =============================================

-- Table: roles (MUST be created before users)
CREATE TABLE IF NOT EXISTS `roles` (
  `role_id` int(11) NOT NULL AUTO_INCREMENT,
  `role_name` varchar(50) NOT NULL,
  PRIMARY KEY (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

INSERT INTO `roles` (`role_id`, `role_name`) VALUES
(1, 'Admin'),
(2, 'Cashier');

-- Table: users
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

INSERT INTO `users` (`user_id`, `role_id`, `full_name`, `username`, `password_hash`, `status`, `created_at`) VALUES
(1, 1, 'Admin', 'admin', '$2b$10$4ULR8D9Dsq9h.X1kLrU6He/xiQtTOcRIOojYCSAXA24JFscXsZ0o2', 'active', NOW()),
(2, 1, 'Backup Admin', 'admin2', '$2b$10$gOBPPrYV0d0sLF7jdSJ15ucqOWLIylI2v.5c.l0nrGhwqIjzi9HNy', 'active', NOW());

-- Table: categories
CREATE TABLE IF NOT EXISTS `categories` (
  `category_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: addons
CREATE TABLE IF NOT EXISTS `addons` (
  `addon_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `status` enum('available','unavailable') DEFAULT 'available',
  PRIMARY KEY (`addon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: items
CREATE TABLE IF NOT EXISTS `items` (
  `item_id` int(11) NOT NULL AUTO_INCREMENT,
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `station` enum('barista','kitchen') NOT NULL,
  `status` enum('available','sold_out') DEFAULT 'available',
  `image` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_customizable` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: customization_groups
CREATE TABLE IF NOT EXISTS `customization_groups` (
  `group_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `selection_type` enum('single','multiple') DEFAULT 'single',
  `input_type` enum('choice','quantity') DEFAULT 'choice',
  `is_required` tinyint(1) DEFAULT 0,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: customization_options
CREATE TABLE IF NOT EXISTS `customization_options` (
  `option_id` int(11) NOT NULL AUTO_INCREMENT,
  `group_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `price_per_unit` decimal(10,2) DEFAULT 0.00,
  `max_quantity` int(11) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `status` enum('available','unavailable') DEFAULT 'available',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_default` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`option_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: item_customization_groups
CREATE TABLE IF NOT EXISTS `item_customization_groups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: discounts
CREATE TABLE IF NOT EXISTS `discounts` (
  `discount_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`discount_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: library_seats
CREATE TABLE IF NOT EXISTS `library_seats` (
  `seat_id` int(11) NOT NULL AUTO_INCREMENT,
  `table_number` int(11) NOT NULL,
  `seat_number` int(11) NOT NULL,
  `status` enum('available','occupied') DEFAULT 'available',
  PRIMARY KEY (`seat_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: library_sessions
CREATE TABLE IF NOT EXISTS `library_sessions` (
  `session_id` int(11) NOT NULL AUTO_INCREMENT,
  `seat_id` int(11) DEFAULT NULL,
  `customer_name` varchar(100) NOT NULL,
  `duration_minutes` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('active','completed','voided') DEFAULT 'active',
  `started_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: transactions
CREATE TABLE IF NOT EXISTS `transactions` (
  `transaction_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) DEFAULT NULL,
  `beeper_number` int(11) NOT NULL,
  `order_type` enum('dine-in','takeout') DEFAULT 'dine-in',
  `subtotal` decimal(10,2) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `library_booking` longtext DEFAULT NULL,
  `library_session_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `cash_tendered` decimal(10,2) DEFAULT NULL,
  `change_due` decimal(10,2) DEFAULT NULL,
  `status` enum('pending','paid','preparing','ready','completed','voided') DEFAULT 'pending',
  `paid_at` datetime DEFAULT NULL,
  `processed_by` int(11) DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `void_reason` text DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`transaction_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: beepers
CREATE TABLE IF NOT EXISTS `beepers` (
  `beeper_number` int(11) NOT NULL,
  `status` enum('available','in-use') DEFAULT 'available',
  `transaction_id` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  PRIMARY KEY (`beeper_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

INSERT INTO `beepers` (`beeper_number`, `status`, `transaction_id`, `assigned_at`) VALUES
(1, 'available', NULL, NULL),
(2, 'available', NULL, NULL),
(3, 'available', NULL, NULL),
(4, 'available', NULL, NULL),
(5, 'available', NULL, NULL),
(6, 'available', NULL, NULL),
(7, 'available', NULL, NULL),
(8, 'available', NULL, NULL),
(9, 'available', NULL, NULL),
(10, 'available', NULL, NULL),
(11, 'available', NULL, NULL),
(12, 'available', NULL, NULL),
(13, 'available', NULL, NULL),
(14, 'available', NULL, NULL),
(15, 'available', NULL, NULL),
(16, 'available', NULL, NULL),
(17, 'available', NULL, NULL),
(18, 'available', NULL, NULL),
(19, 'available', NULL, NULL),
(20, 'available', NULL, NULL);

-- Table: transaction_items
CREATE TABLE IF NOT EXISTS `transaction_items` (
  `transaction_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: transaction_item_customizations
CREATE TABLE IF NOT EXISTS `transaction_item_customizations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_item_id` int(11) NOT NULL,
  `option_id` int(11) NOT NULL,
  `option_name` varchar(50) NOT NULL,
  `group_name` varchar(50) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: orders (kiosk)
CREATE TABLE IF NOT EXISTS `orders` (
  `order_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_number` varchar(20) DEFAULT NULL,
  `order_type` enum('dine-in','takeout') DEFAULT 'dine-in',
  `subtotal` decimal(10,2) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `total_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','confirmed','cancelled') DEFAULT 'pending',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` datetime DEFAULT NULL,
  `seat_id` int(11) DEFAULT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT NULL,
  `library_amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: order_items
CREATE TABLE IF NOT EXISTS `order_items` (
  `order_item_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: order_item_addons
CREATE TABLE IF NOT EXISTS `order_item_addons` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_item_id` int(11) NOT NULL,
  `addon_id` int(11) NOT NULL,
  `addon_name` varchar(50) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: void_log
CREATE TABLE IF NOT EXISTS `void_log` (
  `void_id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(11) NOT NULL,
  `beeper_number` int(11) NOT NULL,
  `voided_by` int(11) NOT NULL,
  `void_reason` text NOT NULL,
  `original_amount` decimal(10,2) NOT NULL,
  `voided_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`void_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

-- Table: quick_cash_amounts
CREATE TABLE IF NOT EXISTS `quick_cash_amounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(10,2) NOT NULL,
  `label` varchar(20) NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

INSERT INTO `quick_cash_amounts` (`id`, `amount`, `label`, `display_order`, `status`) VALUES
(1, 20.00, '₱20', 1, 'active'),
(2, 50.00, '₱50', 2, 'active'),
(3, 100.00, '₱100', 3, 'active'),
(4, 200.00, '₱200', 4, 'active'),
(5, 500.00, '₱500', 5, 'active'),
(6, 1000.00, '₱1000', 6, 'active');

-- Table: system_settings
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_ID_CACHE=1;

INSERT INTO `system_settings` (`setting_key`, `setting_value`) VALUES
('printer_type', 'USB'),
('receipt_footer', 'Thank you for studying with us!'),
('shop_name', 'The Library: Coffee + Study');
