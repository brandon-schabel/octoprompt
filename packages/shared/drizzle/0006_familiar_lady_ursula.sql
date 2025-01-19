CREATE TABLE `ticket_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`content` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
