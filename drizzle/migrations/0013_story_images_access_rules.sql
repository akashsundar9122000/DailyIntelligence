-- Access rules for story_images, hand-written as every access rule is.
--
-- A reader's query sees only `ready` illustrations: a `rejected` one failed
-- its visual check and must never be shown, so row security hides it from the
-- runtime role -- a query that forgot to filter by status still cannot show
-- it. Only the system scope (the illustration job) writes, and reads both.
-- Table privileges come from sql/roles.sql's default privileges.
ALTER TABLE "story_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_images" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_images_read" ON "story_images" FOR SELECT TO di_app
  USING ("status" = 'ready' OR current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "story_images_write" ON "story_images" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');
