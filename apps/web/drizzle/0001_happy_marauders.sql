ALTER TABLE `articles` ADD `kind` text DEFAULT 'article' NOT NULL;--> statement-breakpoint
CREATE INDEX `articles_kind_published_at_idx` ON `articles` (`kind`,`published_at`);--> statement-breakpoint
-- Backfill. Every Short we ever ingested already stored its /shorts/ link in
-- `articles.url`, so reclassifying the whole backlog is an UPDATE rather than
-- a re-fetch of every feed. Kept in step with the regex in src/lib/shorts.ts.
UPDATE `articles` SET `kind` = 'short' WHERE `url` LIKE '%youtube.com/shorts/%';
