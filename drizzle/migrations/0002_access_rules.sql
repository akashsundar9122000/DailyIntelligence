-- Access rules: row-level security for every table, by the class it is given
-- in src/lib/db/classification.ts. Hand-written and kept apart from the
-- generated DDL so it can be read and reviewed as what it is.
--
-- Requires the roles from sql/roles.sql (`pnpm db:roles`) to exist first.
--
-- FORCE as well as ENABLE on every table: without FORCE a table's owner
-- bypasses its own policies, so a deployment that ever connected as the owner
-- would pass every test while protecting nothing.
--
-- A setting cast to uuid goes through NULLIF(..., ''): current_setting returns
-- '' rather than NULL on a reused connection, and ''::uuid raises on every
-- query.
--
-- TWO ROLES.
--   di_auth   the authentication library. A policy on the five tables it owns
--             the contents of, and table privileges on exactly those five.
--   di_app    everything else. On `users` and `sessions` it may READ the
--             signed-in user's own row (or any row as SYSTEM). On accounts,
--             verifications and auth_rate_limits it has NO policy, so it sees
--             nothing: a bug in application code cannot read a one-time code
--             or an OAuth token.

GRANT SELECT, INSERT, UPDATE, DELETE ON "users", "sessions", "accounts", "verifications", "auth_rate_limits" TO di_auth;--> statement-breakpoint

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_auth" ON "users" FOR ALL TO di_auth USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sessions_auth" ON "sessions" FOR ALL TO di_auth USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "accounts_auth" ON "accounts" FOR ALL TO di_auth USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "verifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "verifications_auth" ON "verifications" FOR ALL TO di_auth USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE "auth_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "auth_rate_limits" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "auth_rate_limits_auth" ON "auth_rate_limits" FOR ALL TO di_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "users_self_read" ON "users" FOR SELECT TO di_app
  USING (id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "sessions_self_read" ON "sessions" FOR SELECT TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- SYSTEM-ONLY: visible and writable only inside withSystem().
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "rate_limits_system" ON "rate_limits" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "email_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "email_outbox" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "email_outbox_system" ON "email_outbox" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "job_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "job_runs_system" ON "job_runs" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "audit_events_system" ON "audit_events" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- REFERENCE: sources, items and stories. Any reader, signed in or not, may
-- SELECT; only the system writes. What a reader may SEE is narrower still --
-- showableSource() in src/lib/db/sql.ts -- but that is a display rule, applied
-- by every read query, not an access rule.
ALTER TABLE "sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sources" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "sources_read" ON "sources" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "sources_write" ON "sources" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "raw_source_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "raw_source_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "raw_source_items_read" ON "raw_source_items" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "raw_source_items_write" ON "raw_source_items" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "stories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "stories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "stories_read" ON "stories" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "stories_write" ON "stories" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "story_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_items_read" ON "story_items" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "story_items_write" ON "story_items" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "story_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_updates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_updates_read" ON "story_updates" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "story_updates_write" ON "story_updates" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "story_scores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "story_scores" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "story_scores_read" ON "story_scores" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "story_scores_write" ON "story_scores" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "ingestion_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingestion_runs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ingestion_runs_read" ON "ingestion_runs" FOR SELECT TO di_app USING (true);--> statement-breakpoint
CREATE POLICY "ingestion_runs_write" ON "ingestion_runs" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- OWNER: a reader's own rows, and no one else's. The system may READ them all
-- (to rank a feed, honour a notification rule, send a digest) and writes none,
-- except where noted.
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_settings_owner" ON "user_settings" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "user_settings_system_read" ON "user_settings" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "reader_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reader_profiles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reader_profiles_owner" ON "reader_profiles" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "reader_profiles_system_read" ON "reader_profiles" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "user_interests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_interests" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_interests_owner" ON "user_interests" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "user_interests_system_read" ON "user_interests" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "bookmarks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bookmarks" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "bookmarks_owner" ON "bookmarks" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "bookmarks_system_read" ON "bookmarks" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collections" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "collections_owner" ON "collections" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "collections_system_read" ON "collections" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "collection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "collection_items_owner" ON "collection_items" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "collection_items_system_read" ON "collection_items" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "user_story_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_story_feedback" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_story_feedback_owner" ON "user_story_feedback" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "user_story_feedback_system_read" ON "user_story_feedback" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
ALTER TABLE "reading_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reading_history" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "reading_history_owner" ON "reading_history" FOR ALL TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "reading_history_system_read" ON "reading_history" FOR SELECT TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- content_reports: a reader files and reads their own; the moderation queue
-- (SYSTEM, behind the admin check) reads and resolves all of them.
ALTER TABLE "content_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "content_reports_owner_read" ON "content_reports" FOR SELECT TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "content_reports_owner_insert" ON "content_reports" FOR INSERT TO di_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid AND status = 'open');--> statement-breakpoint
CREATE POLICY "content_reports_system" ON "content_reports" FOR ALL TO di_app
  USING (current_setting('app.role', true) = 'SYSTEM') WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- security_events: the owner reads their own; only the system appends; nobody
-- updates or deletes (there is no policy for either, so both match no rows).
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "security_events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "security_events_read" ON "security_events" FOR SELECT TO di_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid OR current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint
CREATE POLICY "security_events_append" ON "security_events" FOR INSERT TO di_app
  WITH CHECK (current_setting('app.role', true) = 'SYSTEM');--> statement-breakpoint

-- The text that is hashed for one row. One definition, used by the trigger that
-- writes the chain and the function that checks it, so the two cannot disagree.
CREATE FUNCTION security_event_digest(
  p_prev text, p_id uuid, p_user uuid, p_kind text, p_detail jsonb, p_created timestamptz
) RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT encode(
    sha256(convert_to(
      p_prev || '|' || p_id::text || '|' || p_user::text || '|' || p_kind || '|' ||
      p_detail::text || '|' || (extract(epoch FROM p_created) * 1000000)::bigint::text,
      'UTF8')),
    'hex')
$$;--> statement-breakpoint

-- Each row takes the hash of the row before it for the same user. Computed in
-- the database, in the inserting transaction, under a per-user lock: two
-- concurrent inserts would otherwise both read the same "previous" row and
-- fork the chain. The application never supplies either hash.
CREATE FUNCTION security_events_chain() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  previous text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('security_events:' || NEW.user_id::text, 0));
  SELECT hash INTO previous FROM security_events
   WHERE user_id = NEW.user_id ORDER BY seq DESC LIMIT 1;
  NEW.prev_hash := coalesce(previous, '');
  NEW.created_at := coalesce(NEW.created_at, now());
  NEW.hash := security_event_digest(NEW.prev_hash, NEW.id, NEW.user_id, NEW.kind, NEW.detail, NEW.created_at);
  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER security_events_chain BEFORE INSERT ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION security_events_chain();--> statement-breakpoint

-- Recompute the chain for one user and report the first row that does not
-- match. NULL means every row is intact.
CREATE FUNCTION security_events_first_break(p_user uuid) RETURNS bigint
LANGUAGE sql STABLE
AS $$
  WITH ordered AS (
    SELECT seq, prev_hash, hash,
           coalesce(lag(hash) OVER (ORDER BY seq), '') AS expected_prev,
           security_event_digest(prev_hash, id, user_id, kind, detail, created_at) AS expected_hash
      FROM security_events WHERE user_id = p_user
  )
  SELECT min(seq) FROM ordered WHERE prev_hash <> expected_prev OR hash <> expected_hash
$$;--> statement-breakpoint

-- enqueue_email(): the one way a message enters the outbox.
--
-- email_outbox is system-only, but mail is queued from inside whatever
-- transaction caused it -- a reader asking for a sign-in code, a digest being
-- assembled -- so that a rollback sends nothing. Those transactions are not
-- always system scopes, and the table's policy would refuse their insert.
--
-- The function raises the role for the single INSERT and puts it back. It is
-- SECURITY INVOKER on purpose: it grants no database privilege the caller
-- lacks, and it can only ever append a QUEUED or DEV row. It cannot read the
-- outbox, and it is the only statement in the codebase that touches app.role
-- outside src/lib/db/scope.ts.
CREATE FUNCTION enqueue_email(
  p_id uuid,
  p_to text,
  p_subject text,
  p_html text,
  p_text text,
  p_template text,
  p_status text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  previous_role text := coalesce(current_setting('app.role', true), '');
BEGIN
  IF p_status NOT IN ('QUEUED', 'DEV') THEN
    RAISE EXCEPTION 'enqueue_email: status must be QUEUED or DEV' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.role', 'SYSTEM', true);
  INSERT INTO email_outbox (id, to_email, subject, html, text_body, template, status)
  VALUES (p_id, p_to, p_subject, p_html, p_text, p_template, p_status);
  PERFORM set_config('app.role', previous_role, true);

  RETURN p_id;
END
$$;
