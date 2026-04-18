-- Add takeout cup tracking controls and defaults (category-based model).
-- Idempotent migration for MariaDB / MySQL compatible engines.

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS requires_takeout_cup TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) NOT NULL,
    setting_value TEXT DEFAULT NULL,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('takeout_cups_stock', '200')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
