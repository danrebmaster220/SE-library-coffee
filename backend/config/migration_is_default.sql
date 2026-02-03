-- Migration: Add is_default column to customization_options
-- This allows setting a default option for each customization group (e.g., Whole Milk as default)

ALTER TABLE customization_options ADD COLUMN is_default TINYINT(1) DEFAULT 0 AFTER status;

-- Set Whole Milk (option_id=15 in Milk group) as default
UPDATE customization_options SET is_default = 1 WHERE option_id = 15;

-- You can set more defaults here, for example:
-- UPDATE customization_options SET is_default = 1 WHERE option_id = 3; -- Medium 16oz as default size
-- UPDATE customization_options SET is_default = 1 WHERE option_id = 1; -- Hot as default temperature
