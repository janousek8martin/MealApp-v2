CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`date` text NOT NULL,
	`amount_ml` real NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `water_logs_profile_date_idx` ON `water_logs` (`profile_id`,`date`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `enabled_slot_keys_json` text;--> statement-breakpoint
ALTER TABLE `profiles` ADD `track_water` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `water_goal_ml` real;--> statement-breakpoint
ALTER TABLE `profiles` ADD `goal_rate_kg_per_week` real;--> statement-breakpoint
ALTER TABLE `profiles` ADD `custom_tdee_kcal` real;--> statement-breakpoint
-- Backfill the new optional 6th slot ("second dinner") for every household
-- that already exists, seeded disabled so it doesn't change anyone's current
-- day structure. New households get it via defaultSlots at creation time
-- instead; this only covers households created before this migration.
INSERT INTO `meal_slot_settings` (`id`, `created_at`, `updated_at`, `household_id`, `slot_key`, `kind`, `sharing`, `time`, `calorie_share`, `sort_order`, `enabled`)
SELECT
	lower(hex(randomblob(16))),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
	h.id,
	'second_dinner',
	'main',
	'shared',
	'21:00',
	0.1,
	6,
	0
FROM `households` h
WHERE NOT EXISTS (
	SELECT 1 FROM `meal_slot_settings` s
	WHERE s.household_id = h.id AND s.slot_key = 'second_dinner'
);