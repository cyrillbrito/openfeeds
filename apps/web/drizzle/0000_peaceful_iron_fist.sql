CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_id` integer NOT NULL,
	`guid` text NOT NULL,
	`title` text NOT NULL,
	`url` text,
	`author` text,
	`summary` text,
	`content` text,
	`published_at` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_feed_guid_idx` ON `articles` (`feed_id`,`guid`);--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `articles_feed_id_idx` ON `articles` (`feed_id`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_url` text NOT NULL,
	`site_url` text,
	`title` text NOT NULL,
	`description` text,
	`icon_url` text,
	`etag` text,
	`last_modified` text,
	`last_fetched_at` integer,
	`next_fetch_at` integer NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_feed_url_idx` ON `feeds` (`feed_url`);--> statement-breakpoint
CREATE INDEX `feeds_next_fetch_at_idx` ON `feeds` (`next_fetch_at`);