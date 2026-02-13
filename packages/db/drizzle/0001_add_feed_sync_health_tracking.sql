ALTER TABLE "feeds" ADD COLUMN "sync_status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "feeds" ADD COLUMN "sync_fail_count" integer DEFAULT 0 NOT NULL;