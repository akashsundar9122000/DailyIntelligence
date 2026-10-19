-- OWNER: a reader's push subscriptions and the notifications considered for
-- them. The reader sees and changes only their own. The system reads and
-- writes all of them: it decides, sends, records, and revokes a subscription
-- the push service reports gone -- and moves an endpoint to whoever signed in
-- on that browser last.
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "push_subscriptions_owner" ON "push_subscriptions" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "push_subscriptions_system" ON "push_subscriptions" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notification_events_owner" ON "notification_events" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "notification_events_system" ON "notification_events" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- REFERENCE: the operational switches. Anyone may read whether something is
-- paused (the pages say so); only the system changes them.
ALTER TABLE "ops_switches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ops_switches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ops_switches_read" ON "ops_switches" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "ops_switches_write" ON "ops_switches" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');
