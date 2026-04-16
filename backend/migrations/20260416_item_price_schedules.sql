-- Effective-dated item pricing schedules (PH timezone default).
-- NOTE: The backend also runs equivalent idempotent startup migrations in backend/config/migrations.js.
-- Use this SQL file for manual DBA execution when needed.

CREATE TABLE IF NOT EXISTS item_price_schedules (
    schedule_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    price_scope ENUM('base','variant') NOT NULL DEFAULT 'base',
    size_option_id INT NULL,
    temp_option_id INT NULL,
    current_price DECIMAL(10,2) NULL,
    scheduled_price DECIMAL(10,2) NOT NULL,
    status ENUM('pending','applied','cancelled','replaced','failed') NOT NULL DEFAULT 'pending',
    effective_at DATETIME NOT NULL,
    applied_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    replaced_by_schedule_id BIGINT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila',
    notes VARCHAR(255) NULL,
    created_by INT NULL,
    updated_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_price_sched_status_effective (status, effective_at),
    INDEX idx_price_sched_item_scope_status (item_id, price_scope, status, effective_at),
    INDEX idx_price_sched_variant_opts (size_option_id, temp_option_id),
    INDEX idx_price_sched_created_by (created_by),
    INDEX idx_price_sched_updated_by (updated_by),
    INDEX idx_price_sched_replaced_by (replaced_by_schedule_id),
    CONSTRAINT fk_price_sched_item FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_price_sched_size_opt FOREIGN KEY (size_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL,
    CONSTRAINT fk_price_sched_temp_opt FOREIGN KEY (temp_option_id) REFERENCES customization_options(option_id) ON DELETE SET NULL,
    CONSTRAINT fk_price_sched_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_price_sched_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_price_sched_replaced_by FOREIGN KEY (replaced_by_schedule_id) REFERENCES item_price_schedules(schedule_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(50) NOT NULL,
    setting_value TEXT DEFAULT NULL,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO system_settings (setting_key, setting_value)
VALUES
    ('price_update_delay_days', '3'),
    ('price_update_timezone', 'Asia/Manila'),
    ('price_update_delay_options', '3,5,7')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
