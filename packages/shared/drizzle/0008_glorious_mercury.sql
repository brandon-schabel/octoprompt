CREATE TABLE `file_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`original_content` text NOT NULL,
	`suggested_diff` text NOT NULL,
	`status` text NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `global_state`;