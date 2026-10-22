CREATE TABLE `verification_resend` (
	`recipient_hash` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`next_at` integer NOT NULL
);
