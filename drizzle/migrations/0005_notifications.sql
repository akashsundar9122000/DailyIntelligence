CREATE TABLE "ops_switches" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"reason" text,
	"changed_by" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	CONSTRAINT "notification_events_kind_vocab" CHECK ("kind" IN ('breaking', 'hot', 'topic', 'story_update', 'morning_briefing', 'evening_briefing', 'digest', 'test')),
	CONSTRAINT "notification_events_channel_vocab" CHECK ("channel" IN ('push', 'email')),
	CONSTRAINT "notification_events_status_vocab" CHECK ("status" IN ('suppressed', 'queued', 'sent', 'failed', 'opened'))
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_dedupe" ON "notification_events" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_events_user_recent" ON "notification_events" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_events_status" ON "notification_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user" ON "push_subscriptions" USING btree ("user_id");