CREATE TABLE `planned_meal_extras` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`planned_meal_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	FOREIGN KEY (`planned_meal_id`) REFERENCES `planned_meals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `planned_meal_extras_meal_idx` ON `planned_meal_extras` (`planned_meal_id`);