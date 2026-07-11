ALTER TABLE `foods` ADD `can_serve_cold` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `household_settings` ADD `cold_dinner_frequency_per_week` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recipes` ADD `can_serve_cold` integer DEFAULT false NOT NULL;