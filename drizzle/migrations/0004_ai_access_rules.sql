-- ai_briefings is REFERENCE data, written only by the system, like stories.
--
-- One difference: a reader may select only READY rows. A rejected output is
-- the record of what validation stopped -- an uncited claim, a number no
-- source gave -- and must never reach a page, so the rule is enforced here
-- as well as in every query rather than trusted to a WHERE clause alone.
ALTER TABLE "ai_briefings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_briefings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ai_briefings_read" ON "ai_briefings" FOR SELECT TO di_app
  USING ("status" = 'ready' OR current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "ai_briefings_write" ON "ai_briefings" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');
