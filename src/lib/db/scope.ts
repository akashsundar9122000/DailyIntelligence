import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { sql, type SQL } from "drizzle-orm";

import { getDb, rowsOf, type Database } from "./client";

/**
 * Every database access goes through one of these three. Each opens a
 * transaction, records who is acting in transaction-local settings, and lets
 * Postgres row-level security do the filtering.
 *
 * Forgetting a scope is loud in the right way: the runtime role is NOBYPASSRLS
 * and every table has FORCE RLS, so an unscoped query returns nothing at all
 * rather than everything.
 *
 * RLS is the boundary, not the only check. A write still repeats its ownership
 * predicate in the query, and a miss is reported as 404.
 */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class ScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeError";
  }
}

const active = new AsyncLocalStorage<string>();

async function run<T>(label: string, settings: Record<string, string>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  /*
   * Nesting guard. On Neon's single-connection pool an inner transaction waits
   * forever for the connection the outer one is holding: it passes locally,
   * where the pool is larger, and hangs in production. Pass the open `tx` down.
   */
  const outer = active.getStore();
  if (outer) {
    throw new ScopeError(`${label} opened inside ${outer}. Nested scopes deadlock on Neon; pass the transaction down.`);
  }
  const db = getDb();
  return active.run(label, () =>
    db.transaction(async (tx) => {
      // One round trip for all settings. `true` makes each transaction-local,
      // so nothing leaks to the next request that reuses this connection.
      const parts = Object.entries(settings).map(([key, value]) => sql`set_config(${key}, ${value}, true)`);
      await tx.execute(sql`select ${sql.join(parts, sql`, `)}`);
      return fn(tx);
    }),
  );
}

/**
 * A signed-in user acting on their own data. `userId` must come from the
 * verified server session, never from anything the client sent.
 */
export function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return run("withUser", { "app.role": "USER", "app.user_id": userId }, fn);
}

/** A visitor with no session: shared reference data only. */
export function withPublic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return run("withPublic", { "app.role": "ANON", "app.user_id": "" }, fn);
}

/**
 * The platform acting on its own authority: ingestion, scheduled jobs, the
 * mail outbox, rate limiting. It can read and write across users, so every
 * caller must already have established, in code, that the request is entitled
 * to what it is about to do. scripts/check-guards.mjs restricts which
 * directories may call it.
 *
 * `reason` is recorded as app.reason for the audit trail. It grants nothing.
 */
export function withSystem<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return run(`withSystem(${reason})`, { "app.role": "SYSTEM", "app.user_id": "", "app.reason": reason }, fn);
}

export async function execRows<T>(tx: Tx, query: SQL): Promise<T[]> {
  return rowsOf<T>(await tx.execute(query));
}
