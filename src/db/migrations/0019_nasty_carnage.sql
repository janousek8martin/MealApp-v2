ALTER TABLE `foods` ADD `meal_prep_friendly` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `meal_prep_mode` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `meal_prep_friendly` integer DEFAULT false NOT NULL;