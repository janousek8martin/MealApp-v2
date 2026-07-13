ALTER TABLE `household_settings` ADD `allow_same_lunch_dinner` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `prefer_pantry_items` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `meal_variety_level` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `cooking_experience_level` text DEFAULT 'hard' NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `cooking_time_limit_minutes` integer;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `budget_level` text DEFAULT 'high' NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `difficulty` text DEFAULT 'medium' NOT NULL;