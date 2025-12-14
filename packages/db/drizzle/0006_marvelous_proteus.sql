CREATE TABLE `article_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`articleId` integer NOT NULL,
	`tagId` integer NOT NULL,
	FOREIGN KEY (`articleId`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_article_tag` ON `article_tags` (`articleId`,`tagId`);--> statement-breakpoint
CREATE INDEX `article_tags_article_idx` ON `article_tags` (`articleId`);--> statement-breakpoint
CREATE INDEX `article_tags_tag_idx` ON `article_tags` (`tagId`);