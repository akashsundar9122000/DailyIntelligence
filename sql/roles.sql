-- The runtime role. Applied as the database OWNER by `pnpm db:roles`, before
-- the first migration and again whenever this file changes (it is idempotent).
--
-- The application connects as di_app, which is NOBYPASSRLS and owns
-- nothing. That is what makes row-level security a real boundary rather than a
-- decoration: an owner or a superuser bypasses every policy, so an app running
-- as one would pass all the same tests while protecting nothing.
--
-- The consequence to remember when debugging: a query that runs outside a scope
-- does not error. It returns ZERO ROWS.
--
-- :PASSWORD_CLAUSE: and :AUTH_PASSWORD_CLAUSE: are substituted at apply time. On
-- a hosted database each is `PASSWORD '...'`, from APP_DB_PASSWORD and
-- AUTH_DB_PASSWORD, so no credential is ever committed. On
-- a local database with trust authentication it is empty.
-- The ALTER branch names only LOGIN and NOBYPASSRLS. On a hosted database the
-- owner is not a superuser, and Postgres refuses any ALTER ROLE that mentions
-- the SUPERUSER attribute at all -- even NOSUPERUSER -- with "permission
-- denied to alter role". A role cannot acquire that attribute between runs,
-- and the apply script reads rolsuper back and fails if it is ever true.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'di_app') THEN
    CREATE ROLE di_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS :PASSWORD_CLAUSE:;
  ELSE
    ALTER ROLE di_app WITH LOGIN NOBYPASSRLS :PASSWORD_CLAUSE:;
  END IF;
END
$$;

-- The authentication library's role. It reaches the credential tables and
-- nothing else: its table grants are given by the migration that creates those
-- tables, and it has none on any other table. Kept apart from di_app so
-- that a bug in application code cannot read a password hash, a session token
-- or a second-factor secret.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'di_auth') THEN
    CREATE ROLE di_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS :AUTH_PASSWORD_CLAUSE:;
  ELSE
    ALTER ROLE di_auth WITH LOGIN NOBYPASSRLS :AUTH_PASSWORD_CLAUSE:;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE :DATABASE: TO di_auth;
GRANT USAGE ON SCHEMA public TO di_auth;

-- DML only. No CREATE, no DROP, no schema ownership.
GRANT CONNECT ON DATABASE :DATABASE: TO di_app;
GRANT USAGE ON SCHEMA public TO di_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO di_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO di_app;

-- Tables created by future migrations are covered automatically. Without this,
-- every new table is silently invisible to the application.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO di_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO di_app;
