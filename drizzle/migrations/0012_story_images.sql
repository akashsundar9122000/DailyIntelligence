CREATE TABLE "story_images" (
	"id" uuid PRIMARY KEY NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"url" text,
	"width" integer,
	"height" integer,
	"alt" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt" text NOT NULL,
	"rejection" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "story_images_kind_vocab" CHECK ("kind" IN ('ai')),
	CONSTRAINT "story_images_status_vocab" CHECK ("status" IN ('ready', 'rejected')),
	CONSTRAINT "story_images_ready_has_url" CHECK ("status" <> 'ready' OR "url" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "story_images" ADD CONSTRAINT "story_images_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_images_story" ON "story_images" USING btree ("story_id","generated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "story_images_recent" ON "story_images" USING btree ("generated_at" DESC NULLS LAST);