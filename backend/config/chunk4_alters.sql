SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE `addons`
  ADD PRIMARY KEY (`addon_id`);

ALTER TABLE `beepers`
  ADD PRIMARY KEY (`beeper_number`),
  ADD KEY `transaction_id` (`transaction_id`);

ALTER TABLE `categories`
  ADD PRIMARY KEY (`category_id`);

ALTER TABLE `customization_groups`
  ADD PRIMARY KEY (`group_id`);

ALTER TABLE `customization_options`
  ADD PRIMARY KEY (`option_id`),
  ADD KEY `group_id` (`group_id`);

ALTER TABLE `discounts`
  ADD PRIMARY KEY (`discount_id`);

ALTER TABLE `items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `category_id` (`category_id`);

ALTER TABLE `item_customization_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_item_group` (`item_id`,`group_id`),
  ADD KEY `group_id` (`group_id`);

ALTER TABLE `library_seats`
  ADD PRIMARY KEY (`seat_id`);

ALTER TABLE `library_sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `seat_id` (`seat_id`);

ALTER TABLE `library_tables`
  ADD PRIMARY KEY (`table_id`),
  ADD UNIQUE KEY `table_number` (`table_number`);

ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `discount_id` (`discount_id`);

ALTER TABLE `order_items`
  ADD PRIMARY KEY (`order_item_id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `item_id` (`item_id`);

ALTER TABLE `order_item_addons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_item_id` (`order_item_id`),
  ADD KEY `addon_id` (`addon_id`);

ALTER TABLE `order_item_customizations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_item_id` (`order_item_id`),
  ADD KEY `option_id` (`option_id`);

ALTER TABLE `quick_cash_amounts`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`);

ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_key`);

ALTER TABLE `transactions`
  ADD PRIMARY KEY (`transaction_id`),
  ADD KEY `discount_id` (`discount_id`),
  ADD KEY `processed_by` (`processed_by`),
  ADD KEY `voided_by` (`voided_by`),
  ADD KEY `fk_library_session` (`library_session_id`);

ALTER TABLE `transaction_items`
  ADD PRIMARY KEY (`transaction_item_id`),
  ADD KEY `transaction_id` (`transaction_id`),
  ADD KEY `item_id` (`item_id`);

ALTER TABLE `transaction_item_customizations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transaction_item_id` (`transaction_item_id`),
  ADD KEY `option_id` (`option_id`);

ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `role_id` (`role_id`);

ALTER TABLE `void_log`
  ADD PRIMARY KEY (`void_id`),
  ADD KEY `transaction_id` (`transaction_id`),
  ADD KEY `voided_by` (`voided_by`);

ALTER TABLE `addons`
  MODIFY `addon_id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

ALTER TABLE `customization_groups`
  MODIFY `group_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

ALTER TABLE `customization_options`
  MODIFY `option_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

ALTER TABLE `discounts`
  MODIFY `discount_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

ALTER TABLE `item_customization_groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=124;

ALTER TABLE `library_seats`
  MODIFY `seat_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

ALTER TABLE `library_sessions`
  MODIFY `session_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

ALTER TABLE `library_tables`
  MODIFY `table_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `order_items`
  MODIFY `order_item_id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `order_item_addons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `order_item_customizations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

ALTER TABLE `quick_cash_amounts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

ALTER TABLE `transactions`
  MODIFY `transaction_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

ALTER TABLE `transaction_items`
  MODIFY `transaction_item_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

ALTER TABLE `transaction_item_customizations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=136;

ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

ALTER TABLE `void_log`
  MODIFY `void_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

ALTER TABLE `beepers`
  ADD CONSTRAINT `beepers_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`) ON DELETE SET NULL;

ALTER TABLE `customization_options`
  ADD CONSTRAINT `customization_options_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `customization_groups` (`group_id`) ON DELETE CASCADE;

ALTER TABLE `items`
  ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`);

ALTER TABLE `item_customization_groups`
  ADD CONSTRAINT `item_customization_groups_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `item_customization_groups_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `customization_groups` (`group_id`) ON DELETE CASCADE;

ALTER TABLE `library_sessions`
  ADD CONSTRAINT `library_sessions_ibfk_1` FOREIGN KEY (`seat_id`) REFERENCES `library_seats` (`seat_id`);

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`discount_id`);

ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`);

ALTER TABLE `order_item_addons`
  ADD CONSTRAINT `order_item_addons_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`order_item_id`),
  ADD CONSTRAINT `order_item_addons_ibfk_2` FOREIGN KEY (`addon_id`) REFERENCES `addons` (`addon_id`);

ALTER TABLE `order_item_customizations`
  ADD CONSTRAINT `order_item_customizations_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`order_item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_item_customizations_ibfk_2` FOREIGN KEY (`option_id`) REFERENCES `customization_options` (`option_id`);

ALTER TABLE `transactions`
  ADD CONSTRAINT `fk_library_session` FOREIGN KEY (`library_session_id`) REFERENCES `library_sessions` (`session_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`discount_id`),
  ADD CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `transactions_ibfk_3` FOREIGN KEY (`voided_by`) REFERENCES `users` (`user_id`);

ALTER TABLE `transaction_items`
  ADD CONSTRAINT `transaction_items_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transaction_items_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`);

ALTER TABLE `transaction_item_customizations`
  ADD CONSTRAINT `transaction_item_customizations_ibfk_1` FOREIGN KEY (`transaction_item_id`) REFERENCES `transaction_items` (`transaction_item_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `transaction_item_customizations_ibfk_2` FOREIGN KEY (`option_id`) REFERENCES `customization_options` (`option_id`);

ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`);

ALTER TABLE `void_log`
  ADD CONSTRAINT `void_log_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`transaction_id`),
  ADD CONSTRAINT `void_log_ibfk_2` FOREIGN KEY (`voided_by`) REFERENCES `users` (`user_id`);

SET FOREIGN_KEY_CHECKS=1;
