CREATE TABLE `profile_slot_portions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`slot_id` text NOT NULL,
	`calorie_share_percent` real,
	`protein_target_g` real,
	`fat_target_g` real,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`slot_id`) REFERENCES `meal_slot_settings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_slot_portions_profile_idx` ON `profile_slot_portions` (`profile_id`);