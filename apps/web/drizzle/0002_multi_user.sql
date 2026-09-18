CREATE TABLE "article_state" (
	"user_id" text NOT NULL,
	"article_id" integer NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_state_user_id_article_id_pk" PRIMARY KEY("user_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" text NOT NULL,
	"feed_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_user_id_feed_id_pk" PRIMARY KEY("user_id","feed_id")
);
--> statement-breakpoint
ALTER TABLE "article_state" ADD CONSTRAINT "article_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_state" ADD CONSTRAINT "article_state_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_feed_id_idx" ON "subscriptions" USING btree ("feed_id");--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "is_read";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "is_archived";