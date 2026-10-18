import "server-only";

import { neonConfig, Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";

import { env } from "@/lib/env";

import * as schema from "./schema";

/**
 * Neon's serverless driver over WebSockets in deployment; node-postgres for a
 * plain Postgres. Chosen from the URL, not NODE_ENV, so a script pointed at
 * Neon runs the production path and a local database never tries a WebSocket.
 *
 * Neon's pooled endpoint is PgBouncer in transaction mode: only settings made
 * with SET LOCAL survive between statements, which is why every scoped read and
 * write is a transaction (see scope.ts).
 */
neonConfig.webSocketConstructor = ws;

export type Database = ReturnType<typeof drizzleNeon<typeof schema>>;

/** Thrown when no database is configured. Callers turn it into an "unavailable" state. */
export class DatabaseNotConfigured extends Error {
  constructor(variable = "DATABASE_URL") {
    super(`${variable} is not set. See .env.example.`);
    this.name = "DatabaseNotConfigured";
  }
}

let cached: { url: string; db: Database; close: () => Promise<void> } | null = null;

function isNeon(url: string) {
  return /\.neon\.tech|neon\.build/i.test(url);
}

function create(url: string) {
  if (isNeon(url)) {
    // max 1 per warm serverless instance: instances fan out with traffic and
    // each holds its own pool. It is also why nested scopes deadlock -- the
    // guard in scope.ts turns that into an error.
    const pool = new NeonPool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
    return { url, db: drizzleNeon(pool, { schema }) as Database, close: () => pool.end() };
  }
  const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 10_000 });
  return { url, db: drizzlePg(pool, { schema }) as unknown as Database, close: () => pool.end() };
}

export function getDb(): Database {
  const url = env().DATABASE_URL;
  if (!url) throw new DatabaseNotConfigured();
  if (cached?.url === url) return cached.db;
  if (cached) void cached.close();
  cached = create(url);
  return cached.db;
}

let cachedAuth: { url: string; db: Database; close: () => Promise<void> } | null = null;

/**
 * The authentication library's connection: a separate role (di_auth) on a
 * separate pool.
 *
 * A separate ROLE, because the library cannot set the per-transaction actor the
 * application scopes rely on; its role is instead the only one with a policy
 * on the credential tables, and the application's role has none.
 *
 * A separate POOL, because the library opens its own transactions. On Neon's
 * one-connection pool, a library call made while an application scope was open
 * would wait for a connection that scope is holding, for ever.
 *
 * Only lib/auth may call this; check:guards enforces it.
 */
export function getAuthDb(): Database {
  const url = env().DATABASE_URL_AUTH;
  if (!url) throw new DatabaseNotConfigured("DATABASE_URL_AUTH");
  if (cachedAuth?.url === url) return cachedAuth.db;
  if (cachedAuth) void cachedAuth.close();
  cachedAuth = create(url);
  return cachedAuth.db;
}

export async function closeDb(): Promise<void> {
  const open = [cached, cachedAuth].filter((entry) => entry !== null);
  cached = null;
  cachedAuth = null;
  await Promise.all(open.map((entry) => entry.close()));
}

/** node-postgres returns { rows }; the Neon driver returns the array. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) return (result as { rows: T[] }).rows;
  return [];
}
