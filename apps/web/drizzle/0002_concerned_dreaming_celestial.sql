-- The media columns the article list branches on. `kind` is absent from this
-- file on purpose: it is a Drizzle text enum, which SQLite stores as plain
-- text with no CHECK constraint, so widening it from ('article','short') to
-- add 'video', 'podcast' and 'note' is a type change only.
--
-- No backfill here either. Deriving an excerpt means stripping HTML, and
-- SQLite cannot; server/feeds/backfill.ts does it in TypeScript at boot and
-- uses `excerpt IS NULL` as its "never enriched" marker. That is why every
-- writer stores '' rather than NULL for an item that has no excerpt.
ALTER TABLE `articles` ADD `excerpt` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `articles` ADD `image_width` integer;--> statement-breakpoint
ALTER TABLE `articles` ADD `image_height` integer;--> statement-breakpoint
ALTER TABLE `articles` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `articles` ADD `enclosure_url` text;