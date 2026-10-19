-- Merging two stories (admin, phase 4) moves what readers attached to the
-- story being merged -- a save, feedback, the record of having read it -- onto
-- the story it is merged into. The system could only READ these rows, so the
-- move would have changed nothing and reported success, and deleting the
-- merged story would then have cascaded readers' saves away. These policies
-- let the system update and delete them; a reader's own policies are unchanged.
CREATE POLICY "bookmarks_system_update" ON "bookmarks" FOR UPDATE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "bookmarks_system_delete" ON "bookmarks" FOR DELETE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "user_story_feedback_system_update" ON "user_story_feedback" FOR UPDATE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "user_story_feedback_system_delete" ON "user_story_feedback" FOR DELETE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "reading_history_system_update" ON "reading_history" FOR UPDATE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "reading_history_system_delete" ON "reading_history" FOR DELETE TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');
