-- UUID v7 Migration: Convert ULID text IDs to native Postgres uuid columns
-- Strategy: Add new uuid columns, generate UUIDs, update FK references, swap columns
-- Must run in dependency order: parent tables first, then children

-- ============================================================
-- STEP 1: Add new UUID columns to all tables
-- PK columns get NOT NULL DEFAULT uuidv7() (auto-populates existing rows)
-- FK columns are nullable until populated
-- ============================================================
ALTER TABLE "feeds" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "new_feed_id" uuid;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "feed_tags" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "feed_tags" ADD COLUMN "new_feed_id" uuid;--> statement-breakpoint
ALTER TABLE "feed_tags" ADD COLUMN "new_tag_id" uuid;--> statement-breakpoint
ALTER TABLE "article_tags" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "article_tags" ADD COLUMN "new_article_id" uuid;--> statement-breakpoint
ALTER TABLE "article_tags" ADD COLUMN "new_tag_id" uuid;--> statement-breakpoint
ALTER TABLE "filter_rules" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "filter_rules" ADD COLUMN "new_feed_id" uuid;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD COLUMN "new_id" uuid NOT NULL DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD COLUMN "new_feed_id" uuid;--> statement-breakpoint

-- ============================================================
-- STEP 2: Populate FK columns by joining on old ULID values
-- ============================================================
UPDATE "articles" a SET "new_feed_id" = f."new_id" FROM "feeds" f WHERE a."feed_id" = f."id";--> statement-breakpoint
UPDATE "feed_tags" ft SET "new_feed_id" = f."new_id" FROM "feeds" f WHERE ft."feed_id" = f."id";--> statement-breakpoint
UPDATE "feed_tags" ft SET "new_tag_id" = t."new_id" FROM "tags" t WHERE ft."tag_id" = t."id";--> statement-breakpoint
UPDATE "article_tags" at2 SET "new_article_id" = a."new_id" FROM "articles" a WHERE at2."article_id" = a."id";--> statement-breakpoint
UPDATE "article_tags" at2 SET "new_tag_id" = t."new_id" FROM "tags" t WHERE at2."tag_id" = t."id";--> statement-breakpoint
UPDATE "filter_rules" fr SET "new_feed_id" = f."new_id" FROM "feeds" f WHERE fr."feed_id" = f."id";--> statement-breakpoint
UPDATE "feed_sync_logs" fsl SET "new_feed_id" = f."new_id" FROM "feeds" f WHERE fsl."feed_id" = f."id";--> statement-breakpoint

-- ============================================================
-- STEP 3: Drop all foreign key constraints
-- ============================================================
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_feed_id_feeds_id_fk";--> statement-breakpoint
ALTER TABLE "feed_tags" DROP CONSTRAINT IF EXISTS "feed_tags_feed_id_feeds_id_fk";--> statement-breakpoint
ALTER TABLE "feed_tags" DROP CONSTRAINT IF EXISTS "feed_tags_tag_id_tags_id_fk";--> statement-breakpoint
ALTER TABLE "article_tags" DROP CONSTRAINT IF EXISTS "article_tags_article_id_articles_id_fk";--> statement-breakpoint
ALTER TABLE "article_tags" DROP CONSTRAINT IF EXISTS "article_tags_tag_id_tags_id_fk";--> statement-breakpoint
ALTER TABLE "filter_rules" DROP CONSTRAINT IF EXISTS "filter_rules_feed_id_feeds_id_fk";--> statement-breakpoint
ALTER TABLE "feed_sync_logs" DROP CONSTRAINT IF EXISTS "feed_sync_logs_feed_id_feeds_id_fk";--> statement-breakpoint

-- ============================================================
-- STEP 4: Drop old PK constraints and indexes that reference old columns
-- ============================================================
ALTER TABLE "feeds" DROP CONSTRAINT IF EXISTS "feeds_pkey";--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_pkey";--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_pkey";--> statement-breakpoint
ALTER TABLE "feed_tags" DROP CONSTRAINT IF EXISTS "feed_tags_pkey";--> statement-breakpoint
ALTER TABLE "article_tags" DROP CONSTRAINT IF EXISTS "article_tags_pkey";--> statement-breakpoint
ALTER TABLE "filter_rules" DROP CONSTRAINT IF EXISTS "filter_rules_pkey";--> statement-breakpoint
ALTER TABLE "feed_sync_logs" DROP CONSTRAINT IF EXISTS "feed_sync_logs_pkey";--> statement-breakpoint
DROP INDEX IF EXISTS "unique_feed_tag";--> statement-breakpoint
DROP INDEX IF EXISTS "unique_article_tag";--> statement-breakpoint
DROP INDEX IF EXISTS "articles_feed_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_tags_tag_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "article_tags_tag_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "filter_rules_feed_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feed_sync_logs_feed_id_idx";--> statement-breakpoint

-- ============================================================
-- STEP 5: Drop old columns
-- ============================================================
ALTER TABLE "feeds" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "id", DROP COLUMN "feed_id";--> statement-breakpoint
ALTER TABLE "tags" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "feed_tags" DROP COLUMN "id", DROP COLUMN "feed_id", DROP COLUMN "tag_id";--> statement-breakpoint
ALTER TABLE "article_tags" DROP COLUMN "id", DROP COLUMN "article_id", DROP COLUMN "tag_id";--> statement-breakpoint
ALTER TABLE "filter_rules" DROP COLUMN "id", DROP COLUMN "feed_id";--> statement-breakpoint
ALTER TABLE "feed_sync_logs" DROP COLUMN "id", DROP COLUMN "feed_id";--> statement-breakpoint

-- ============================================================
-- STEP 6: Rename new columns to original names
-- ============================================================
ALTER TABLE "feeds" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "articles" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "articles" RENAME COLUMN "new_feed_id" TO "feed_id";--> statement-breakpoint
ALTER TABLE "tags" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "feed_tags" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "feed_tags" RENAME COLUMN "new_feed_id" TO "feed_id";--> statement-breakpoint
ALTER TABLE "feed_tags" RENAME COLUMN "new_tag_id" TO "tag_id";--> statement-breakpoint
ALTER TABLE "article_tags" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "article_tags" RENAME COLUMN "new_article_id" TO "article_id";--> statement-breakpoint
ALTER TABLE "article_tags" RENAME COLUMN "new_tag_id" TO "tag_id";--> statement-breakpoint
ALTER TABLE "filter_rules" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "filter_rules" RENAME COLUMN "new_feed_id" TO "feed_id";--> statement-breakpoint
ALTER TABLE "feed_sync_logs" RENAME COLUMN "new_id" TO "id";--> statement-breakpoint
ALTER TABLE "feed_sync_logs" RENAME COLUMN "new_feed_id" TO "feed_id";--> statement-breakpoint

-- ============================================================
-- STEP 7: Set NOT NULL on FK columns (articles.feed_id stays nullable)
-- ============================================================
ALTER TABLE "feed_tags" ALTER COLUMN "feed_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_tags" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "article_tags" ALTER COLUMN "article_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "article_tags" ALTER COLUMN "tag_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_rules" ALTER COLUMN "feed_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ALTER COLUMN "feed_id" SET NOT NULL;--> statement-breakpoint

-- ============================================================
-- STEP 8: Re-add primary keys
-- ============================================================
ALTER TABLE "feeds" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "articles" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "tags" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "feed_tags" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "article_tags" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "filter_rules" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD PRIMARY KEY ("id");--> statement-breakpoint

-- ============================================================
-- STEP 9: Re-add foreign key constraints
-- ============================================================
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feed_tags" ADD CONSTRAINT "feed_tags_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feed_tags" ADD CONSTRAINT "feed_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "filter_rules" ADD CONSTRAINT "filter_rules_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD CONSTRAINT "feed_sync_logs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "feeds"("id") ON DELETE CASCADE;--> statement-breakpoint

-- ============================================================
-- STEP 10: Re-add indexes
-- ============================================================
CREATE INDEX "articles_feed_id_idx" ON "articles" ("feed_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_feed_tag" ON "feed_tags" ("feed_id", "tag_id");--> statement-breakpoint
CREATE INDEX "feed_tags_tag_idx" ON "feed_tags" ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_article_tag" ON "article_tags" ("article_id", "tag_id");--> statement-breakpoint
CREATE INDEX "article_tags_tag_idx" ON "article_tags" ("tag_id");--> statement-breakpoint
CREATE INDEX "filter_rules_feed_id_idx" ON "filter_rules" ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_sync_logs_feed_id_idx" ON "feed_sync_logs" ("feed_id");
