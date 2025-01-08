ALTER TABLE `files` ADD `summary` text DEFAULT '';--> statement-breakpoint
ALTER TABLE `files` ADD `summary_last_updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
ALTER TABLE `files` ADD `meta` text DEFAULT '';