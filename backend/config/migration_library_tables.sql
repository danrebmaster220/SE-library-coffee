-- Migration: Add library_tables table for editable table names
-- Run this SQL against your coffee_db database

-- Create library_tables table to store table metadata
CREATE TABLE IF NOT EXISTS `library_tables` (
  `table_id` int(11) NOT NULL AUTO_INCREMENT,
  `table_number` int(11) NOT NULL UNIQUE,
  `table_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Populate library_tables with existing tables from library_seats
INSERT IGNORE INTO library_tables (table_number, table_name)
SELECT DISTINCT table_number, CONCAT('Table ', table_number) as table_name
FROM library_seats
ORDER BY table_number;
