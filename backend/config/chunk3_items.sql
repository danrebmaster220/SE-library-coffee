SET FOREIGN_KEY_CHECKS=0;

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(2, 1, 'Americano', NULL, 150.00, 'barista', 'available', NULL, '2025-11-28 22:34:29', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(3, 1, 'Caffe Latte', NULL, 200.00, 'barista', 'available', NULL, '2025-11-28 22:41:15', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(4, 1, 'Cafe Mocha', NULL, 250.00, 'barista', 'available', NULL, '2025-11-30 16:07:11', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(5, 1, 'Cappucino', NULL, 250.00, 'barista', 'available', NULL, '2025-11-30 16:08:01', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(6, 2, 'Matcha Frap', NULL, 200.00, 'barista', 'available', NULL, '2025-11-30 16:08:41', 1),
(7, 5, 'Carfrappe', NULL, 200.00, 'barista', 'available', NULL, '2025-11-30 16:10:18', 1),
(8, 5, 'Coffefrappe', NULL, 250.00, 'barista', 'available', NULL, '2025-11-30 16:11:13', 1),
(9, 5, 'Strawfrappe', NULL, 250.00, 'barista', 'available', NULL, '2025-11-30 16:12:30', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(10, 9, 'Burger', NULL, 159.00, 'kitchen', 'available', NULL, '2025-12-01 17:05:38', 1);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(11, 2, 'Matchalover', NULL, 900.00, 'barista', 'available', NULL, '2025-12-01 17:07:00', 1),
(12, 4, 'Pinoy Pasta', NULL, 200.00, 'kitchen', 'available', NULL, '2025-12-02 21:49:33', 0),
(13, 3, 'Mountain Dew', NULL, 25.00, 'barista', 'available', NULL, '2025-12-02 21:56:08', 0);

INSERT INTO `items` (`item_id`, `category_id`, `name`, `description`, `price`, `station`, `status`, `image`, `created_at`, `is_customizable`) VALUES
(14, 3, 'Testing', NULL, 26.00, 'barista', 'available', NULL, '2025-12-04 01:04:31', 0);

SET FOREIGN_KEY_CHECKS=1;
