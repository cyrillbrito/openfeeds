PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`feedId` text,
	`title` text NOT NULL,
	`url` text,
	`description` text,
	`content` text,
	`author` text,
	`guid` text,
	`pubDate` integer,
	`isRead` integer DEFAULT false,
	`isArchived` integer DEFAULT false,
	`cleanContent` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`feedId`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_articles`("id", "feedId", "title", "url", "description", "content", "author", "guid", "pubDate", "isRead", "isArchived", "cleanContent", "createdAt") SELECT "id", "feedId", "title", "url", "description", "content", "author", "guid", "pubDate", "isRead", "isArchived", "cleanContent", "createdAt" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;