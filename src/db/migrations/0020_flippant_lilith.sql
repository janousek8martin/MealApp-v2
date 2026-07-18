ALTER TABLE `foods` ADD `needs_review` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `foods` ADD `nova_group` integer;--> statement-breakpoint
ALTER TABLE `foods` ADD `nutri_score_grade` text;--> statement-breakpoint
ALTER TABLE `foods` ADD `eco_score_grade` text;