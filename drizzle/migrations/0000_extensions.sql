-- Extensions the schema relies on. Before any table, so the trigram indexes in
-- the next migration have their operator class.
--
-- pg_trgm: title similarity for clustering and fuzzy search suggestions. It
-- ships with Postgres and is available on Neon; IF NOT EXISTS because on Neon
-- an extension may already be installed for the database.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
