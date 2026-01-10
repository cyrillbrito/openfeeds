PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_article_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`articleId` text NOT NULL,
	`tagId` text NOT NULL,
	FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_article_tags`("id", "articleId", "tagId") SELECT "id", "articleId", "tagId" FROM `article_tags`;--> statement-breakpoint
DROP TABLE `article_tags`;--> statement-breakpoint
ALTER TABLE `__new_article_tags` RENAME TO `article_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_article_tag` ON `article_tags` (`articleId`,`tagId`);--> statement-breakpoint
CREATE INDEX `article_tags_article_idx` ON `article_tags` (`articleId`);--> statement-breakpoint
CREATE INDEX `article_tags_tag_idx` ON `article_tags` (`tagId`);--> statement-breakpoint
CREATE TABLE `__new_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`feedId` text NOT NULL,
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
CREATE TABLE `__new_feed_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`feedId` text NOT NULL,
	`tagId` text NOT NULL,
	FOREIGN KEY (`feedId`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_feed_tags`("id", "feedId", "tagId") SELECT "id", "feedId", "tagId" FROM `feed_tags`;--> statement-breakpoint
DROP TABLE `feed_tags`;--> statement-breakpoint
ALTER TABLE `__new_feed_tags` RENAME TO `feed_tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_feed_tag` ON `feed_tags` (`feedId`,`tagId`);--> statement-breakpoint
CREATE TABLE `__new_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`feedUrl` text NOT NULL,
	`icon` text,
	`lastSyncAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_feeds`("id", "title", "description", "url", "feedUrl", "icon", "lastSyncAt", "createdAt") SELECT "id", "title", "description", "url", "feedUrl", "icon", "lastSyncAt", "createdAt" FROM `feeds`;--> statement-breakpoint
DROP TABLE `feeds`;--> statement-breakpoint
ALTER TABLE `__new_feeds` RENAME TO `feeds`;--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_feedUrl_unique` ON `feeds` (`feedUrl`);--> statement-breakpoint
CREATE TABLE `__new_filter_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`feedId` text NOT NULL,
	`pattern` text NOT NULL,
	`operator` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer,
	FOREIGN KEY (`feedId`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_filter_rules`("id", "feedId", "pattern", "operator", "isActive", "createdAt", "updatedAt") SELECT "id", "feedId", "pattern", "operator", "isActive", "createdAt", "updatedAt" FROM `filter_rules`;--> statement-breakpoint
DROP TABLE `filter_rules`;--> statement-breakpoint
ALTER TABLE `__new_filter_rules` RENAME TO `filter_rules`;--> statement-breakpoint
CREATE INDEX `filter_rules_feed_id_idx` ON `filter_rules` (`feedId`);--> statement-breakpoint
CREATE INDEX `filter_rules_active_idx` ON `filter_rules` (`isActive`);--> statement-breakpoint
CREATE TABLE `__new_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tags`("id", "name", "color", "createdAt") SELECT "id", "name", "color", "createdAt" FROM `tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `__new_tags` RENAME TO `tags`;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);