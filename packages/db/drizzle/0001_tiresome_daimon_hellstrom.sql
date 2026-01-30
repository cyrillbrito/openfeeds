DROP INDEX "article_tags_article_idx";--> statement-breakpoint
DROP INDEX "tags_user_id_idx";--> statement-breakpoint
ALTER TABLE "article_tags" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "feed_tags" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "filter_rules" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_tags" ADD CONSTRAINT "feed_tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filter_rules" ADD CONSTRAINT "filter_rules_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "article_tags_user_id_idx" ON "article_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_tags_user_id_idx" ON "feed_tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feed_tags_tag_idx" ON "feed_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "filter_rules_user_id_idx" ON "filter_rules" USING btree ("user_id");