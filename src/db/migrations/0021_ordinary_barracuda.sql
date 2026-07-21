CREATE TABLE `streak_freezes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `streak_freezes_profile_kind_date_idx` ON `streak_freezes` (`profile_id`,`kind`,`date`);