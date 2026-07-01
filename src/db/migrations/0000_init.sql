CREATE TABLE `body_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`date` text NOT NULL,
	`weight_kg` real NOT NULL,
	`body_fat_pct` real,
	`method` text,
	`neck_cm` real,
	`waist_cm` real,
	`hip_cm` real,
	`note` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `body_metrics_profile_date_idx` ON `body_metrics` (`profile_id`,`date`);--> statement-breakpoint
CREATE TABLE `food_restrictions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`food_id` text NOT NULL,
	`allergen` text NOT NULL,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `food_restrictions_food_idx` ON `food_restrictions` (`food_id`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name_cs` text NOT NULL,
	`name_en` text NOT NULL,
	`category` text NOT NULL,
	`base_unit` text DEFAULT 'g' NOT NULL,
	`grams_per_piece` real,
	`kcal_per_100` real NOT NULL,
	`protein_per_100` real NOT NULL,
	`carbs_per_100` real NOT NULL,
	`fat_per_100` real NOT NULL,
	`fiber_per_100` real,
	`micronutrients_json` text,
	`diet_flags_json` text,
	`budget` text DEFAULT 'average' NOT NULL,
	`shelf_life_days` integer,
	`storage` text,
	`snack_suitable` integer DEFAULT false NOT NULL,
	`barcode` text,
	`source` text DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `household_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`unit_system` text DEFAULT 'metric' NOT NULL,
	`language` text DEFAULT 'cs' NOT NULL,
	`default_max_repetitions_per_week` integer DEFAULT 2 NOT NULL,
	`default_allow_consecutive_days` integer DEFAULT false NOT NULL,
	`fiber_mode` text DEFAULT 'efsa_min' NOT NULL,
	`notifications_json` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`breakfast_mode` text DEFAULT 'shared' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meal_slot_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`slot_key` text NOT NULL,
	`kind` text NOT NULL,
	`sharing` text NOT NULL,
	`time` text NOT NULL,
	`calorie_share` real NOT NULL,
	`sort_order` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `meal_slot_household_idx` ON `meal_slot_settings` (`household_id`);--> statement-breakpoint
CREATE TABLE `pantry_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`food_id` text NOT NULL,
	`quantity` real NOT NULL,
	`purchased_at` text,
	`expires_at` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pantry_items_household_idx` ON `pantry_items` (`household_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`owner_type` text NOT NULL,
	`owner_id` text NOT NULL,
	`uri` text NOT NULL,
	`taken_at` text,
	`ai_metadata_json` text
);
--> statement-breakpoint
CREATE INDEX `photos_owner_idx` ON `photos` (`owner_type`,`owner_id`);--> statement-breakpoint
CREATE TABLE `planned_meal_portions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`planned_meal_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`multiplier` real NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	FOREIGN KEY (`planned_meal_id`) REFERENCES `planned_meals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `planned_meal_portions_meal_idx` ON `planned_meal_portions` (`planned_meal_id`);--> statement-breakpoint
CREATE TABLE `planned_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`date` text NOT NULL,
	`slot_key` text NOT NULL,
	`profile_id` text,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `planned_meals_household_date_idx` ON `planned_meals` (`household_id`,`date`);--> statement-breakpoint
CREATE TABLE `profile_avoided_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_avoided_profile_idx` ON `profile_avoided_items` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profile_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_favorites_profile_idx` ON `profile_favorites` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profile_restrictions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_restrictions_profile_idx` ON `profile_restrictions` (`profile_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`profile_type` text DEFAULT 'adult' NOT NULL,
	`sex` text NOT NULL,
	`birth_date` text NOT NULL,
	`height_cm` real NOT NULL,
	`activity_level` text NOT NULL,
	`goal` text DEFAULT 'maintain' NOT NULL,
	`goal_weight_kg` real,
	`goal_body_fat_pct` real,
	`fitness_experience` text,
	`shares_main_meals` integer DEFAULT true NOT NULL,
	`workout_days_json` text,
	`snack_positions_json` text,
	`tdci_manual_adjustment_kcal` real DEFAULT 0 NOT NULL,
	`macro_overrides_json` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profiles_household_idx` ON `profiles` (`household_id`);--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`recipe_id` text NOT NULL,
	`food_id` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recipe_ingredients_recipe_idx` ON `recipe_ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name_cs` text NOT NULL,
	`name_en` text NOT NULL,
	`instructions_cs` text,
	`instructions_en` text,
	`category` text NOT NULL,
	`is_side` integer DEFAULT false NOT NULL,
	`budget` text DEFAULT 'average' NOT NULL,
	`servings_base` real DEFAULT 1 NOT NULL,
	`prep_time_minutes` integer,
	`tags_json` text,
	`max_repetitions_per_week` integer,
	`allow_consecutive_days` integer,
	`source` text DEFAULT 'user' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`food_id` text,
	`custom_name` text,
	`quantity` real,
	`unit` text,
	`horizon` text DEFAULT 'weekly' NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`auto_generated` integer DEFAULT true NOT NULL,
	`note` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `shopping_list_household_idx` ON `shopping_list_items` (`household_id`);