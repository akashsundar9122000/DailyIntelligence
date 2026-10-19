CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"embed_url" text NOT NULL,
	"author_handle" text NOT NULL,
	"author_name" text,
	"author_url" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tokens" text[] DEFAULT '{}'::text[] NOT NULL,
	"hashtags" text[] DEFAULT '{}'::text[] NOT NULL,
	"language" text,
	"replies" integer DEFAULT 0 NOT NULL,
	"reposts" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"story_id" uuid,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_platform_vocab" CHECK ("platform" IN ('mastodon', 'bluesky', 'youtube'))
);
--> statement-breakpoint
CREATE TABLE "story_embeddings" (
	"story_id" uuid PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" halfvec(2048) NOT NULL,
	"embedded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_embeddings" ADD CONSTRAINT "story_embeddings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_source_external" ON "social_posts" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "social_posts_story" ON "social_posts" USING btree ("story_id","posted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "social_posts_recent" ON "social_posts" USING btree ("posted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "story_embeddings_hnsw" ON "story_embeddings" USING hnsw ("embedding" halfvec_cosine_ops);