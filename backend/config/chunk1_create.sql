SET FOREIGN_KEY_CHECKS=0;

CREATE TABLE `addons` (
  `addon_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `status` enum('available','unavailable') DEFAULT 'available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `beepers` (
  `beeper_number` int(11) NOT NULL,
  `status` enum('available','in-use') DEFAULT 'available',
  `transaction_id` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `customization_groups` (
  `group_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `selection_type` enum('single','multiple') DEFAULT 'single',
  `input_type` enum('choice','quantity') DEFAULT 'choice',
  `is_required` tinyint(1) DEFAULT 0,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `customization_options` (
  `option_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `price_per_unit` decimal(10,2) DEFAULT 0.00,
  `max_quantity` int(11) DEFAULT 1,
  `display_order` int(11) DEFAULT 0,
  `status` enum('available','unavailable') DEFAULT 'available',
  `created_at` datetime DEFAULT current_timestamp(),
  `is_default` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `discounts` (
  `discount_id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `percentage` decimal(5,2) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `items` (
  `item_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `station` enum('barista','kitchen') NOT NULL,
  `status` enum('available','sold_out') DEFAULT 'available',
  `image` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_customizable` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `item_customization_groups` (
  `id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `library_seats` (
  `seat_id` int(11) NOT NULL,
  `table_number` int(11) NOT NULL,
  `seat_number` int(11) NOT NULL,
  `status` enum('available','occupied','maintenance') DEFAULT 'available'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `library_sessions` (
  `session_id` int(11) NOT NULL,
  `seat_id` int(11) NOT NULL,
  `customer_name` varchar(100) DEFAULT NULL,
  `start_time` datetime DEFAULT current_timestamp(),
  `end_time` datetime DEFAULT NULL,
  `total_minutes` int(11) DEFAULT 0,
  `amount_due` decimal(10,2) DEFAULT 0.00,
  `status` enum('active','completed','voided') DEFAULT 'active',
  `paid_minutes` int(11) DEFAULT 0,
  `amount_paid` decimal(10,2) DEFAULT 0.00,
  `cash_tendered` decimal(10,2) DEFAULT NULL,
  `change_due` decimal(10,2) DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `void_reason` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `library_tables` (
  `table_id` int(11) NOT NULL,
  `table_number` int(11) NOT NULL,
  `table_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL,
  `beeper_number` int(11) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `final_amount` decimal(10,2) NOT NULL,
  `payment_type` enum('cash','online') DEFAULT 'cash',
  `cash_tendered` decimal(10,2) DEFAULT 0.00,
  `change_due` decimal(10,2) DEFAULT 0.00,
  `status` enum('pending','preparing','ready','completed','cancelled') DEFAULT 'pending',
  `payment_status` enum('unpaid','paid') DEFAULT 'unpaid',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `order_items` (
  `order_item_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `order_item_addons` (
  `id` int(11) NOT NULL,
  `order_item_id` int(11) NOT NULL,
  `addon_id` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `order_item_customizations` (
  `id` int(11) NOT NULL,
  `order_item_id` int(11) NOT NULL,
  `option_id` int(11) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `quick_cash_amounts` (
  `id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `label` varchar(20) NOT NULL,
  `display_order` int(11) DEFAULT 0,
  `status` enum('active','inactive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `system_settings` (
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `transactions` (
  `transaction_id` int(11) NOT NULL,
  `order_number` varchar(20) DEFAULT NULL,
  `beeper_number` int(11) NOT NULL,
  `order_type` enum('dine-in','takeout') DEFAULT 'dine-in',
  `subtotal` decimal(10,2) NOT NULL,
  `discount_id` int(11) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `library_booking` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`library_booking`)),
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
  `created_at` datetime DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `transaction_items` (
  `transaction_item_id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `item_name` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `transaction_item_customizations` (
  `id` int(11) NOT NULL,
  `transaction_item_id` int(11) NOT NULL,
  `option_id` int(11) NOT NULL,
  `option_name` varchar(50) NOT NULL,
  `group_name` varchar(50) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `void_log` (
  `void_id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `beeper_number` int(11) NOT NULL,
  `voided_by` int(11) NOT NULL,
  `void_reason` text NOT NULL,
  `original_amount` decimal(10,2) NOT NULL,
  `voided_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS=1;
