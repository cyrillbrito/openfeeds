DROP INDEX "articles_user_id_idx";--> statement-breakpoint
CREATE INDEX "articles_user_id_guid_idx" ON "articles" USING btree ("user_id","guid");