-- ==========================================
-- SEED DATA for Library Coffee + Study POS
-- Run this AFTER creating the database schema
-- ==========================================

USE coffee_db;

-- ==========================================
-- 1. SEED CATEGORIES
-- ==========================================
INSERT INTO categories (name, status) VALUES
('Coffee-Based Drinks', 'active'),
('Non-Coffee Drinks', 'active'),
('Pastries', 'active'),
('Pasta', 'active'),
('Sandwiches', 'active');

-- ==========================================
-- 2. SEED ITEMS
-- ==========================================

-- Coffee-Based Drinks
INSERT INTO items (category_id, name, description, price, station, status) VALUES
(1, 'Espresso', 'Strong and bold single shot', 80.00, 'barista', 'available'),
(1, 'Americano', 'Espresso with hot water', 100.00, 'barista', 'available'),
(1, 'Cappuccino', 'Espresso with steamed milk and foam', 120.00, 'barista', 'available'),
(1, 'Caffe Latte', 'Smooth espresso with steamed milk', 130.00, 'barista', 'available'),
(1, 'Caramel Macchiato', 'Vanilla and caramel sweetness', 150.00, 'barista', 'available'),
(1, 'Mocha', 'Chocolate and espresso blend', 140.00, 'barista', 'available'),
(1, 'Flat White', 'Velvety microfoam over espresso', 135.00, 'barista', 'available');

-- Non-Coffee Drinks
INSERT INTO items (category_id, name, description, price, station, status) VALUES
(2, 'Hot Chocolate', 'Rich and creamy chocolate drink', 110.00, 'barista', 'available'),
(2, 'Matcha Latte', 'Japanese green tea with milk', 140.00, 'barista', 'available'),
(2, 'Strawberry Smoothie', 'Fresh strawberry blend', 130.00, 'barista', 'available'),
(2, 'Mango Smoothie', 'Tropical mango goodness', 130.00, 'barista', 'available'),
(2, 'Lemon Iced Tea', 'Refreshing citrus tea', 90.00, 'barista', 'available');

-- Pastries
INSERT INTO items (category_id, name, description, price, station, status) VALUES
(3, 'Croissant', 'Buttery and flaky pastry', 85.00, 'kitchen', 'available'),
(3, 'Blueberry Muffin', 'Fresh baked with blueberries', 95.00, 'kitchen', 'available'),
(3, 'Chocolate Chip Cookie', 'Warm and gooey', 70.00, 'kitchen', 'available'),
(3, 'Cinnamon Roll', 'Sweet and sticky', 105.00, 'kitchen', 'available'),
(3, 'Banana Bread', 'Moist and delicious', 90.00, 'kitchen', 'available');

-- Pasta
INSERT INTO items (category_id, name, description, price, station, status) VALUES
(4, 'Carbonara', 'Creamy bacon pasta', 180.00, 'kitchen', 'available'),
(4, 'Aglio e Olio', 'Garlic and olive oil pasta', 150.00, 'kitchen', 'available'),
(4, 'Pesto Pasta', 'Basil and pine nut sauce', 170.00, 'kitchen', 'available'),
(4, 'Bolognese', 'Meat sauce pasta', 190.00, 'kitchen', 'available');

-- Sandwiches
INSERT INTO items (category_id, name, description, price, station, status) VALUES
(5, 'Club Sandwich', 'Triple-layer with chicken, bacon, and veggies', 165.00, 'kitchen', 'available'),
(5, 'Tuna Sandwich', 'Fresh tuna with lettuce and tomato', 140.00, 'kitchen', 'available'),
(5, 'BLT Sandwich', 'Bacon, lettuce, and tomato', 155.00, 'kitchen', 'available'),
(5, 'Grilled Cheese', 'Melted cheese on toasted bread', 120.00, 'kitchen', 'available');

-- ==========================================
-- 3. SEED DISCOUNTS
-- ==========================================
INSERT INTO discounts (name, percentage, status) VALUES
('Senior Citizen', 20.00, 'active'),
('PWD', 20.00, 'active'),
('Employee', 15.00, 'active'),
('Student', 10.00, 'active');

-- ==========================================
-- 4. SEED USERS
-- Password for all users: "password123"
-- (Hashed with bcrypt, 10 rounds)
-- ==========================================
INSERT INTO users (role_id, full_name, username, password_hash, status) VALUES
(1, 'Admin User', 'admin', '$2b$10$YQ5xZ8YhZ7XZ8YhZ7XZ8YuY5xZ8YhZ7XZ8YhZ7XZ8YhZ7XZ8YhZ7X', 'active'),
(2, 'John Cashier', 'cashier', '$2b$10$YQ5xZ8YhZ7XZ8YhZ7XZ8YuY5xZ8YhZ7XZ8YhZ7XZ8YhZ7XZ8YhZ7X', 'active'),
(3, 'Maria Barista', 'barista', '$2b$10$YQ5xZ8YhZ7XZ8YhZ7XZ8YuY5xZ8YhZ7XZ8YhZ7XZ8YhZ7XZ8YhZ7X', 'active');

-- Note: The above hash is a placeholder. Run the seed_users.js script to generate proper hashes.

-- ==========================================
-- 5. SEED LIBRARY SEATS (24 seats)
-- ==========================================
-- Table 1 (8 seats)
INSERT INTO library_seats (table_number, seat_number, status) VALUES
(1, 1, 'available'),
(1, 2, 'available'),
(1, 3, 'available'),
(1, 4, 'available'),
(1, 5, 'available'),
(1, 6, 'available'),
(1, 7, 'available'),
(1, 8, 'available');

-- Table 2 (8 seats)
INSERT INTO library_seats (table_number, seat_number, status) VALUES
(2, 1, 'available'),
(2, 2, 'available'),
(2, 3, 'available'),
(2, 4, 'available'),
(2, 5, 'available'),
(2, 6, 'available'),
(2, 7, 'available'),
(2, 8, 'available');

-- Table 3 (8 seats)
INSERT INTO library_seats (table_number, seat_number, status) VALUES
(3, 1, 'available'),
(3, 2, 'available'),
(3, 3, 'available'),
(3, 4, 'available'),
(3, 5, 'available'),
(3, 6, 'available'),
(3, 7, 'available'),
(3, 8, 'available');

-- ==========================================
-- DONE!
-- ==========================================
-- Now you have:
-- ✅ 5 Categories
-- ✅ 28 Menu Items
-- ✅ 4 Discount Types
-- ✅ 3 Users (admin, cashier, barista)
-- ✅ 24 Library Seats
-- ==========================================
