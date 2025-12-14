CREATE TABLE `filter_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedId` integer NOT NULL,
	`pattern` text NOT NULL,
	`operator` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`feedId`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `filter_rules_feed_id_idx` ON `filter_rules` (`feedId`);--> statement-breakpoint
CREATE INDEX `filter_rules_active_idx` ON `filter_rules` (`isActive`);