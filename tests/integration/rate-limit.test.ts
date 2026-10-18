import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb } from "@/lib/db/client";
import { execRows, withPublic, withSystem } from "@/lib/db/scope";
import { take } from "@/lib/rate-limit";

afterAll(async () => {
  await closeDb();
});

const limit = { max: 3, windowSeconds: 60 };
const at = new Date("2026-01-05T10:00:10Z");

describe("the rate limiter", () => {
  it("allows up to the limit and refuses the next request in the same window", async () => {
    const subject = `ip:${uuidv7()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await take(subject, limit, at));

    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
    expect(results[3]?.retryAfterSeconds).toBe(50);
  });

  it("starts again in the next window", async () => {
    const subject = `ip:${uuidv7()}`;
    for (let i = 0; i < 4; i++) await take(subject, limit, at);
    const next = await take(subject, limit, new Date("2026-01-05T10:01:00Z"));
    expect(next).toMatchObject({ ok: true, count: 1 });
  });

  it("counts concurrent requests exactly once each", async () => {
    const subject = `ip:${uuidv7()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => take(subject, limit, at)));
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(results.filter((r) => r.ok)).toHaveLength(3);
  });

  it("stores a keyed hash, never the subject it counted", async () => {
    const subject = `ip:203.0.113.${Date.now() % 250}-${uuidv7()}`;
    await take(subject, limit, at);
    const rows = await withSystem("test", (tx) =>
      execRows<{ n: number }>(tx, sql`select count(*)::int as n from rate_limits where key like ${"%" + subject + "%"}`),
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("refuses to run inside another scope rather than deadlock", async () => {
    // Counted inside the caller's transaction, a refused request would roll its
    // own count back. Inside a scope it fails open, loudly, and counts nothing.
    const taken = await withPublic(() => take(`ip:${uuidv7()}`, limit, at));
    expect(taken).toEqual({ ok: true, count: 0, retryAfterSeconds: 0 });
  });
});
