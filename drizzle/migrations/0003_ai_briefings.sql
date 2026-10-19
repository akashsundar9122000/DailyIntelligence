CREATE TABLE "ai_briefings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"story_id" uuid,
	"edition_key" text,
	"status" text NOT NULL,
	"model" text,
	"prompt_version" text NOT NULL,
	"bundle_hash" text NOT NULL,
	"source_item_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"content" jsonb,
	"rejection" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_briefings_kind_vocab" CHECK ("kind" IN ('story_explainer', 'edition_briefing')),
	CONSTRAINT "ai_briefings_status_vocab" CHECK ("status" IN ('ready', 'rejected', 'failed')),
	CONSTRAINT "ai_briefings_subject" CHECK (("kind" = 'story_explainer' AND "story_id" IS NOT NULL) OR ("kind" = 'edition_briefing' AND "edition_key" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "categories_by" text DEFAULT 'rules' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_briefings" ADD CONSTRAINT "ai_briefings_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_briefings_story" ON "ai_briefings" USING btree ("story_id","kind","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_briefings_edition" ON "ai_briefings" USING btree ("edition_key","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_briefings_recent" ON "ai_briefings" USING btree ("generated_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_categories_by_vocab" CHECK ("categories_by" IN ('rules', 'ai'));