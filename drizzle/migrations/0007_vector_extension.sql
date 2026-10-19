-- pgvector, for semantic search over story headlines (story_embeddings).
-- Available on Neon and, for development and CI, from Homebrew's pgvector and
-- the pgvector/pgvector Postgres image. Its own migration, before the table
-- that needs it, so a database without the extension fails here, by name.
CREATE EXTENSION IF NOT EXISTS vector;
