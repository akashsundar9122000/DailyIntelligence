-- REFERENCE: social posts and story embeddings. Readable by any reader (what a
-- page may SHOW of a post is narrower: only a cleared source's, through the
-- platform's own embed -- showableSocial() in src/lib/db/sql.ts); written only
-- by the system.
ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "social_posts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "social_posts_read" ON "social_posts" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "social_posts_write" ON "social_posts" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "story_embeddings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_embeddings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_embeddings_read" ON "story_embeddings" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "story_embeddings_write" ON "story_embeddings" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');
