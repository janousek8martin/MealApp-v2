CREATE TABLE `household_avoided_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `household_avoided_household_idx` ON `household_avoided_items` (`household_id`);--> statement-breakpoint
CREATE TABLE `household_restrictions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `household_restrictions_household_idx` ON `household_restrictions` (`household_id`);--> statement-breakpoint
ALTER TABLE `household_settings` ADD `favorite_cuisines_json` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `cuisine` text;