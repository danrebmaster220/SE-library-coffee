-- Split display name + optional profile photo (same storage style as items.image — LONGTEXT data URL).
-- NOTE: The backend runs the same steps automatically on startup via backend/config/migrations.js
-- (Migration 15: addUsersProfileColumns). Use this file only for manual DBA runs or if you disable auto-migrations.

ALTER TABLE users
  ADD COLUMN first_name VARCHAR(100) NULL AFTER full_name,
  ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN last_name VARCHAR(100) NULL AFTER middle_name,
  ADD COLUMN profile_image LONGTEXT NULL AFTER last_name;

-- Backfill first/last from legacy full_name
UPDATE users SET
  first_name = TRIM(SUBSTRING_INDEX(full_name, ' ', 1)),
  last_name = TRIM(
    CASE
      WHEN full_name LIKE '% %' THEN SUBSTRING(full_name, LENGTH(SUBSTRING_INDEX(full_name, ' ', 1)) + 2)
      ELSE ''
    END
  )
WHERE first_name IS NULL;

-- Normalize full_name from parts (optional; keeps reports/search consistent)
UPDATE users SET
  full_name = TRIM(CONCAT_WS(
    ' ',
    NULLIF(TRIM(first_name), ''),
    NULLIF(TRIM(middle_name), ''),
    NULLIF(TRIM(last_name), '')
  ))
WHERE TRIM(CONCAT_WS(' ', first_name, middle_name, last_name)) <> '';
