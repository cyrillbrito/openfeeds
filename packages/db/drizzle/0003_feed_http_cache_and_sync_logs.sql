CREATE TABLE "feed_sync_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"feed_id" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"http_status" integer,
	"error" text,
	"articles_added" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "etag_header" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "last_modified_header" text;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD CONSTRAINT "feed_sync_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD CONSTRAINT "feed_sync_logs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_sync_logs_user_id_idx" ON "feed_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_sync_logs_feed_id_idx" ON "feed_sync_logs" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_sync_logs_created_at_idx" ON "feed_sync_logs" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "feeds" DROP COLUMN "sync_fail_count";