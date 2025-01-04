PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_file_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`project_id` text NOT NULL,
	`summary` text NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_file_summaries`("id", "file_id", "project_id", "summary", "updated_at", "expires_at") SELECT "id", "file_id", "project_id", "summary", "updated_at", "expires_at" FROM `file_summaries`;--> statement-breakpoint
DROP TABLE `file_summaries`;--> statement-breakpoint
ALTER TABLE `__new_file_summaries` RENAME TO `file_summaries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;