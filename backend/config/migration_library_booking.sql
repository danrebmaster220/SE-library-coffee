-- Migration: Add library_booking column to transactions table
-- This stores the library booking data from kiosk orders

ALTER TABLE transactions ADD COLUMN library_booking JSON DEFAULT NULL AFTER discount_amount;

-- Also add library_session_id to link completed orders with library sessions
ALTER TABLE transactions ADD COLUMN library_session_id INT DEFAULT NULL AFTER library_booking;
ALTER TABLE transactions ADD CONSTRAINT fk_library_session FOREIGN KEY (library_session_id) REFERENCES library_sessions(session_id) ON DELETE SET NULL;
