CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_rate_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "security_events_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prev_hash" text DEFAULT '' NOT NULL,
	"hash" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"step_up_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"http_status" integer,
	"fetched" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"quarantined" integer DEFAULT 0 NOT NULL,
	"clustered" integer DEFAULT 0 NOT NULL,
	"error" text,
	CONSTRAINT "ingestion_runs_status_vocab" CHECK ("status" IN ('running', 'ok', 'not_modified', 'partial', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "raw_source_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"provider_item_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"url_hash" text NOT NULL,
	"publisher_domain" text NOT NULL,
	"publisher_name" text,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"excerpt" text,
	"author" text,
	"language" text DEFAULT 'en' NOT NULL,
	"content_type" text DEFAULT 'report' NOT NULL,
	"media_url" text,
	"published_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"event_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"indian_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quarantined" boolean DEFAULT false NOT NULL,
	"quarantine_reason" text,
	"expires_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("raw_source_items"."title", '') || ' ' || coalesce("raw_source_items"."publisher_name", ''))) STORED,
	CONSTRAINT "raw_items_content_vocab" CHECK ("content_type" IN ('report', 'official_statement', 'preprint', 'social_post', 'video', 'commentary'))
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"canonical_domain" text NOT NULL,
	"source_type" text NOT NULL,
	"provider" text NOT NULL,
	"feed_url" text NOT NULL,
	"country_or_region" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"rights_status" text DEFAULT 'pending_review' NOT NULL,
	"terms_url" text,
	"rights_checked_on" text,
	"rights_note" text DEFAULT '' NOT NULL,
	"commercial_use_allowed" boolean DEFAULT false NOT NULL,
	"headline_display_allowed" boolean DEFAULT false NOT NULL,
	"excerpt_display_allowed" boolean DEFAULT false NOT NULL,
	"ai_summary_allowed" boolean DEFAULT false NOT NULL,
	"media_reuse_allowed" boolean DEFAULT false NOT NULL,
	"retention_days" integer,
	"attribution_text" text DEFAULT '' NOT NULL,
	"removal_contact" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"disable_reason" text,
	"priority" integer DEFAULT 50 NOT NULL,
	"poll_interval_seconds" integer DEFAULT 900 NOT NULL,
	"next_poll_at" timestamp with time zone DEFAULT now() NOT NULL,
	"leased_until" timestamp with time zone,
	"etag" text,
	"last_modified" text,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"circuit_open_until" timestamp with time zone,
	"health_status" text DEFAULT 'unknown' NOT NULL,
	"newest_item_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_provider_vocab" CHECK ("provider" IN ('gdelt_gkg', 'gdelt_doc', 'rss', 'bluesky', 'mastodon', 'youtube')),
	CONSTRAINT "sources_type_vocab" CHECK ("source_type" IN ('aggregator', 'publisher', 'official', 'research', 'social', 'video')),
	CONSTRAINT "sources_rights_vocab" CHECK ("rights_status" IN ('cleared', 'pending_review', 'excluded')),
	CONSTRAINT "sources_health_vocab" CHECK ("health_status" IN ('unknown', 'healthy', 'degraded', 'failing', 'stale', 'disabled')),
	CONSTRAINT "sources_enabled_needs_clearance" CHECK (NOT "enabled" OR "rights_status" = 'cleared')
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"headline" text NOT NULL,
	"headline_item_id" uuid,
	"primary_category" text,
	"categories" text[] DEFAULT '{}'::text[] NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"event_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"indian_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'developing' NOT NULL,
	"signature" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"official_count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_published_at" timestamp with time zone,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"heat" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"importance" integer DEFAULT 0 NOT NULL,
	"score_version" text,
	"scored_at" timestamp with time zone,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("stories"."headline", ''))) STORED,
	CONSTRAINT "stories_state_vocab" CHECK ("state" IN ('developing', 'active', 'cooling', 'closed')),
	CONSTRAINT "stories_scope_vocab" CHECK ("scope" IN ('india', 'global')),
	CONSTRAINT "stories_scores_range" CHECK ("heat" BETWEEN 0 AND 100 AND "confidence" BETWEEN 0 AND 100 AND "importance" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "story_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"story_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"association_confidence" integer NOT NULL,
	"method" text NOT NULL,
	"associated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"story_id" uuid NOT NULL,
	"version" text NOT NULL,
	"heat" integer NOT NULL,
	"heat_components" jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"confidence_components" jsonb NOT NULL,
	"importance" integer NOT NULL,
	"importance_components" jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_updates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"story_id" uuid NOT NULL,
	"text" text NOT NULL,
	"evidence_item_ids" uuid[] NOT NULL,
	"occurred_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verification" text DEFAULT 'sourced' NOT NULL,
	CONSTRAINT "story_updates_verification_vocab" CHECK ("verification" IN ('sourced', 'official', 'disputed')),
	CONSTRAINT "story_updates_has_evidence" CHECK (cardinality("evidence_item_ids") > 0)
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text_body" text NOT NULL,
	"template" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_status_vocab" CHECK ("status" IN ('QUEUED', 'SENT', 'FAILED', 'DEV'))
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	CONSTRAINT "job_runs_status_vocab" CHECK ("status" IN ('RUNNING', 'OK', 'PARTIAL', 'FAILED', 'SKIPPED'))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"source_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"note" text,
	"headline_snapshot" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"user_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"bookmark_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_bookmark_id_pk" PRIMARY KEY("collection_id","bookmark_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_name_length" CHECK (char_length("name") BETWEEN 1 AND 80)
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid,
	"item_id" uuid,
	"reason" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "content_reports_reason_vocab" CHECK ("reason" IN ('misleading', 'misattributed', 'duplicate', 'wrong_category', 'harmful', 'rights', 'other')),
	CONSTRAINT "content_reports_status_vocab" CHECK ("status" IN ('open', 'actioned', 'dismissed')),
	CONSTRAINT "content_reports_detail_length" CHECK (char_length("detail") <= 2000)
);
--> statement-breakpoint
CREATE TABLE "reader_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"onboarding_step" integer,
	"onboarded_at" timestamp with time zone,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"notify_breaking" boolean DEFAULT false NOT NULL,
	"notify_hot" boolean DEFAULT false NOT NULL,
	"notify_topics" boolean DEFAULT false NOT NULL,
	"notify_story_updates" boolean DEFAULT false NOT NULL,
	"morning_briefing" boolean DEFAULT false NOT NULL,
	"evening_briefing" boolean DEFAULT false NOT NULL,
	"email_digest" boolean DEFAULT false NOT NULL,
	"morning_at" text DEFAULT '07:30' NOT NULL,
	"evening_at" text DEFAULT '19:00' NOT NULL,
	"quiet_hours" boolean DEFAULT true NOT NULL,
	"quiet_start" text DEFAULT '22:00' NOT NULL,
	"quiet_end" text DEFAULT '07:00' NOT NULL,
	"daily_cap" integer DEFAULT 3 NOT NULL,
	"paused_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reader_profiles_step_range" CHECK ("onboarding_step" IS NULL OR "onboarding_step" BETWEEN 1 AND 6),
	CONSTRAINT "reader_profiles_cap_range" CHECK ("daily_cap" BETWEEN 0 AND 20),
	CONSTRAINT "reader_profiles_times" CHECK ("morning_at" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "evening_at" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "quiet_start" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "quiet_end" ~ '^[0-2][0-9]:[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"first_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opens" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "reading_history_user_id_story_id_pk" PRIMARY KEY("user_id","story_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"stance" text DEFAULT 'follow' NOT NULL,
	"priority" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"origin" text DEFAULT 'explicit' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_kind_vocab" CHECK ("kind" IN ('category', 'region', 'state', 'entity', 'keyword', 'source')),
	CONSTRAINT "user_interests_stance_vocab" CHECK ("stance" IN ('follow', 'mute', 'block')),
	CONSTRAINT "user_interests_origin_vocab" CHECK ("origin" IN ('explicit', 'inferred')),
	CONSTRAINT "user_interests_priority_explicit" CHECK (NOT "priority" OR ("origin" = 'explicit' AND "stance" = 'follow'))
);
--> statement-breakpoint
CREATE TABLE "user_story_feedback" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"story_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_kind_vocab" CHECK ("kind" IN ('more', 'less', 'hide'))
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_source_items" ADD CONSTRAINT "raw_source_items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_items" ADD CONSTRAINT "story_items_item_id_raw_source_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."raw_source_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_scores" ADD CONSTRAINT "story_scores_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_updates" ADD CONSTRAINT "story_updates_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_bookmark_id_bookmarks_id_fk" FOREIGN KEY ("bookmark_id") REFERENCES "public"."bookmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_item_id_raw_source_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."raw_source_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_profiles" ADD CONSTRAINT "reader_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_story_feedback" ADD CONSTRAINT "user_story_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_story_feedback" ADD CONSTRAINT "user_story_feedback_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_rate_limits_key" ON "auth_rate_limits" USING btree ("key");--> statement-breakpoint
CREATE INDEX "security_events_user_idx" ON "security_events" USING btree ("user_id","seq" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "verifications_expires_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_source" ON "ingestion_runs" USING btree ("source_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ingestion_runs_recent" ON "ingestion_runs" USING btree ("started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "raw_items_source_item" ON "raw_source_items" USING btree ("source_id","provider_item_id");--> statement-breakpoint
CREATE INDEX "raw_items_url_hash" ON "raw_source_items" USING btree ("url_hash");--> statement-breakpoint
CREATE INDEX "raw_items_recent" ON "raw_source_items" USING btree ("ingested_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "raw_items_published" ON "raw_source_items" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "raw_items_search" ON "raw_source_items" USING gin ("search");--> statement-breakpoint
CREATE INDEX "raw_items_title_trgm" ON "raw_source_items" USING gin ("normalized_title" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key" ON "sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "sources_due" ON "sources" USING btree ("enabled","next_poll_at");--> statement-breakpoint
CREATE INDEX "stories_recent" ON "stories" USING btree ("last_updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stories_scope_recent" ON "stories" USING btree ("scope","last_updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stories_heat" ON "stories" USING btree ("heat" DESC NULLS LAST,"last_updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stories_categories" ON "stories" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "stories_search" ON "stories" USING gin ("search");--> statement-breakpoint
CREATE INDEX "stories_signature_trgm" ON "stories" USING gin ("signature" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "story_items_item" ON "story_items" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "story_items_story" ON "story_items" USING btree ("story_id","associated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "story_scores_story" ON "story_scores" USING btree ("story_id","calculated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "story_updates_story" ON "story_updates" USING btree ("story_id","added_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_outbox_recent" ON "email_outbox" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "email_outbox_to" ON "email_outbox" USING btree ("to_email","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_runs_by_job" ON "job_runs" USING btree ("job","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_events_recent" ON "audit_events" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_story" ON "bookmarks" USING btree ("user_id","story_id");--> statement-breakpoint
CREATE INDEX "bookmarks_user_recent" ON "bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collection_items_user" ON "collection_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_name" ON "collections" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "content_reports_status" ON "content_reports" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "content_reports_user" ON "content_reports" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reading_history_recent" ON "reading_history" USING btree ("user_id","last_opened_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_interests_unique" ON "user_interests" USING btree ("user_id","kind","value");--> statement-breakpoint
CREATE INDEX "user_interests_user" ON "user_interests" USING btree ("user_id","stance");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_user_story_kind" ON "user_story_feedback" USING btree ("user_id","story_id","kind");--> statement-breakpoint
CREATE INDEX "feedback_user_recent" ON "user_story_feedback" USING btree ("user_id","created_at" DESC NULLS LAST);