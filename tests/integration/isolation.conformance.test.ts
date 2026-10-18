import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, describe, expect, it } from "vitest";

import { TABLE_CLASSES } from "@/lib/db/classification";
import { closeDb, getDb } from "@/lib/db/client";
import { execRows, ScopeError, withPublic, withSystem, withUser } from "@/lib/db/scope";

/*
 * Isolation conformance, read from the LIVE CATALOGUE rather than from the
 * migration files: what Postgres holds is what decides who sees a row.
 */

afterAll(async () => {
  await closeDb();
});

type CatalogueRow = { table: string; rls: boolean; forced: boolean; policies: number; owner: string };

async function catalogue(): Promise<CatalogueRow[]> {
  return withSystem("conformance", (tx) =>
    execRows<CatalogueRow>(
      tx,
      sql`select c.relname as table,
                 c.relrowsecurity as rls,
                 c.relforcerowsecurity as forced,
                 (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies,
                 pg_get_userbyid(c.relowner) as owner
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
          order by c.relname`,
    ),
  );
}

describe("the runtime role", () => {
  it("is a plain role that cannot bypass row-level security", async () => {
    const rows = await withPublic((tx) =>
      execRows<{ name: string; bypass: boolean; superuser: boolean }>(
        tx,
        sql`select current_user as name, rolbypassrls as bypass, rolsuper as superuser
            from pg_roles where rolname = current_user`,
      ),
    );
    // If this were the owner or a superuser, every other test in this file
    // would pass while proving nothing.
    expect(rows).toEqual([{ name: "di_app", bypass: false, superuser: false }]);
  });
});

describe("table classification", () => {
  it("covers every table that exists, and nothing that does not", async () => {
    const live = (await catalogue()).map((row) => row.table).sort();
    expect(live).toEqual(Object.keys(TABLE_CLASSES).sort());
  });

  it("finds row-level security enabled, forced and backed by a policy on every table", async () => {
    const weak = (await catalogue()).filter((row) => !row.rls || !row.forced || row.policies === 0);
    expect(weak).toEqual([]);
  });

  it("finds no table owned by the runtime role", async () => {
    // An owner can drop its own policies.
    const owned = (await catalogue()).filter((row) => row.owner === "di_app");
    expect(owned).toEqual([]);
  });
});

describe("system-only tables", () => {
  const job = `conformance-${uuidv7()}`;

  it("accept a write inside withSystem, and the row is there when read back", async () => {
    await withSystem("conformance", (tx) =>
      tx.execute(sql`insert into job_runs (id, job, trigger) values (${uuidv7()}, ${job}, 'test')`),
    );
    const rows = await withSystem("conformance", (tx) =>
      execRows<{ status: string }>(tx, sql`select status from job_runs where job = ${job}`),
    );
    expect(rows).toEqual([{ status: "RUNNING" }]);
  });

  it("are invisible to a visitor", async () => {
    const rows = await withPublic((tx) => execRows(tx, sql`select 1 from job_runs where job = ${job}`));
    expect(rows).toEqual([]);
  });

  it("are invisible to a signed-in user", async () => {
    const rows = await withUser(uuidv7(), (tx) => execRows(tx, sql`select 1 from job_runs where job = ${job}`));
    expect(rows).toEqual([]);
  });

  it("refuse a write from outside withSystem", async () => {
    await expect(
      withUser(uuidv7(), (tx) =>
        tx.execute(sql`insert into job_runs (id, job, trigger) values (${uuidv7()}, ${job}, 'test')`),
      ),
    ).rejects.toThrow();
    // And nothing was written: still exactly the one row from the first test.
    const rows = await withSystem("conformance", (tx) =>
      execRows<{ n: number }>(tx, sql`select count(*)::int as n from job_runs where job = ${job}`),
    );
    expect(rows[0]?.n).toBe(1);
  });

  it("return nothing to a query that runs outside any scope", async () => {
    // The failure mode this whole design is built around: forgetting a scope
    // must show an empty result, never everybody's rows.
    const result = await getDb().execute(sql`select 1 from job_runs where job = ${job}`);
    const rows = Array.isArray(result) ? result : (result as { rows: unknown[] }).rows;
    expect(rows).toEqual([]);
  });
});

describe("scopes", () => {
  it("record who is acting for the length of the transaction", async () => {
    const userId = uuidv7();
    const seen = await withUser(userId, (tx) =>
      execRows<{ role: string; user_id: string }>(
        tx,
        sql`select current_setting('app.role', true) as role, current_setting('app.user_id', true) as user_id`,
      ),
    );
    expect(seen).toEqual([{ role: "USER", user_id: userId }]);
  });

  it("do not leak authority to the next transaction on the same connection", async () => {
    await withSystem("conformance", (tx) => tx.execute(sql`select 1`));
    const after = await withPublic((tx) =>
      execRows<{ role: string }>(tx, sql`select current_setting('app.role', true) as role`),
    );
    expect(after).toEqual([{ role: "ANON" }]);
  });

  it("refuse to nest, because a nested scope deadlocks on a one-connection pool", async () => {
    await expect(withPublic(() => withSystem("inner", async () => 1))).rejects.toBeInstanceOf(ScopeError);
  });

  it("can be opened again after one has finished or failed", async () => {
    await expect(
      withPublic(async () => {
        throw new Error("the work failed");
      }),
    ).rejects.toThrow("the work failed");
    await expect(withPublic(async () => "fine")).resolves.toBe("fine");
  });
});
