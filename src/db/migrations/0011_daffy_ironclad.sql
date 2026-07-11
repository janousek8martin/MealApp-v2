CREATE TABLE `profile_item_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`profile_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`rating` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profile_item_ratings_profile_idx` ON `profile_item_ratings` (`profile_id`);
--> statement-breakpoint
INSERT INTO `profile_item_ratings` (`id`, `created_at`, `updated_at`, `deleted_at`, `profile_id`, `item_type`, `item_id`, `rating`)
SELECT `id`, `created_at`, `updated_at`, `deleted_at`, `profile_id`, 'recipe', `recipe_id`, 'like' FROM `profile_favorites`;