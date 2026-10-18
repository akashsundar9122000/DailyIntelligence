import "server-only";

import { sql } from "drizzle-orm";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";

export type Health = {
  ok: boolean;
  /** `unconfigured`: no DATABASE_URL. `unreachable`: it is set and the query failed. */
  database: "ok" | "unconfigured" | "unreachable";
  /** The role the application is connected as. A name, not a credential. */
  runtimeRole: string | null;
  /**
   * False when that role could bypass row-level security -- a superuser, a
   * BYPASSRLS role, or the owner of a table. Every policy would then be
   * decorative, and nothing else would look wrong.
   */
  rowSecurityEnforced: boolean;
  /** The deployed commit, so "is this the build I pushed?" has an answer. */
  commit: string | null;
};

export async function checkHealth(): Promise<Health> {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  try {
    const rows = await withPublic((tx) =>
      execRows<{ name: string; bypass: boolean; superuser: boolean; owned: number }>(
        tx,
        sql`select current_user as name,
                   r.rolbypassrls as bypass,
                   r.rolsuper as superuser,
                   (select count(*)::int from pg_class c
                      join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'r'
                       and c.relowner = r.oid) as owned
            from pg_roles r where r.rolname = current_user`,
      ),
    );
    const role = rows[0];
    const enforced = Boolean(role && !role.bypass && !role.superuser && role.owned === 0);
    return { ok: enforced, database: "ok", runtimeRole: role?.name ?? null, rowSecurityEnforced: enforced, commit };
  } catch (error) {
    const unconfigured = error instanceof DatabaseNotConfigured;
    if (!unconfigured) console.error("[health] database check failed:", error instanceof Error ? error.name : "unknown");
    return {
      ok: false,
      database: unconfigured ? "unconfigured" : "unreachable",
      runtimeRole: null,
      rowSecurityEnforced: false,
      commit,
    };
  }
}
