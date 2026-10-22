CREATE TABLE `api_rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `api_rate_limit_reset_idx` ON `api_rate_limit` (`reset_at`);