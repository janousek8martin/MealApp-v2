CREATE TABLE `household_custom_units` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`unit_type` text NOT NULL,
	`conversion_value` real NOT NULL,
	`aliases_json` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `household_custom_units_household_idx` ON `household_custom_units` (`household_id`);--> statement-breakpoint
ALTER TABLE `household_settings` ADD `kitchen_unit_display_mode` text DEFAULT 'hybrid' NOT NULL;