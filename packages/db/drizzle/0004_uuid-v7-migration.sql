ALTER TABLE "article_tags" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "article_tags" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "article_tags" ALTER COLUMN "article_id" SET DATA TYPE uuid USING "article_id"::uuid;--> statement-breakpoint
ALTER TABLE "article_tags" ALTER COLUMN "tag_id" SET DATA TYPE uuid USING "tag_id"::uuid;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "feed_id" SET DATA TYPE uuid USING "feed_id"::uuid;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ALTER COLUMN "feed_id" SET DATA TYPE uuid USING "feed_id"::uuid;--> statement-breakpoint
ALTER TABLE "feed_tags" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "feed_tags" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "feed_tags" ALTER COLUMN "feed_id" SET DATA TYPE uuid USING "feed_id"::uuid;--> statement-breakpoint
ALTER TABLE "feed_tags" ALTER COLUMN "tag_id" SET DATA TYPE uuid USING "tag_id"::uuid;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "feeds" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "filter_rules" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "filter_rules" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "filter_rules" ALTER COLUMN "feed_id" SET DATA TYPE uuid USING "feed_id"::uuid;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "id" SET DEFAULT uuidv7();
