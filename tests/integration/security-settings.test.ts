import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { deleteAccount } from "@/lib/auth/account";
import { listDeviceSessions, revokeDeviceSession, revokeOtherDeviceSessions } from "@/lib/auth/sessions";
import { sessionFromHeaders } from "@/lib/auth/session";
import { sendStepUpCode } from "@/lib/auth/step-up";
import { closeDb } from "@/lib/db/client";
import { execRows, withSystem, withUser } from "@/lib/db/scope";
import { updatePreferences } from "@/lib/services/preferences";

import { createVerifiedUser, latestCode, signIn } from "./auth-helpers";

afterAll(async () => {
  await closeDb();
});

const cookieHeaders = (cookie: string, extra: Record<string, string> = {}) =>
  new Headers({ cookie, origin: "http://localhost:4620", "x-forwarded-proto": "http", host: "localhost:4620", "x-real-ip": "203.0.113.9", ...extra });

const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

async function ownerQuery<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
  await owner.connect();
  try {
    return (await owner.query<T>(text, values)).rows;
  } finally {
    await owner.end();
  }
}

const mailCount = async (email: string, template: string) =>
  (await withSystem("test", (tx) => execRows<{ n: number }>(tx, sql`select count(*)::int as n from email_outbox where to_email = ${email} and template = ${template}`)))[0]!.n;

/** A fresh confirmation code for this session's own address. */
async function confirmationCode(cookie: string): Promise<{ headers: Headers; code: string }> {
  const headers = cookieHeaders(cookie);
  const session = (await sessionFromHeaders(headers))!;
  await sendStepUpCode(session, headers);
  return { headers, code: await latestCode(session.user.email, "confirm-code") };
}

describe("device sessions", () => {
  it("lists every open session, marks the current one, and never includes a token", async () => {
    const { email, userId, cookie } = await createVerifiedUser();
    const first = { cookie };
    await signIn(email, { headers: { "user-agent": FIREFOX } });
    const current = (await sessionFromHeaders(cookieHeaders(first.cookie)))!;

    const devices = await listDeviceSessions(userId, current.sessionId);
    expect(devices).toHaveLength(2);
    expect(devices.filter((device) => device.current)).toHaveLength(1);
    expect(devices.map((device) => device.device).sort()).toEqual(["Chrome on macOS", "Firefox on Linux"]);
    expect(devices[0]!.network).toBe("203.0.x.x");
    // Instants are ISO strings made by Postgres, not driver-dependent Dates.
    for (const device of devices) {
      expect(device.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(Math.abs(Date.now() - new Date(device.lastActiveAt).getTime())).toBeLessThan(60_000);
    }
    const token = first.cookie.split("=")[1]!.split(".")[0]!;
    expect(JSON.stringify(devices)).not.toContain(token);
    expect(Object.keys(devices[0]!)).not.toContain("token");
  });

  it("ends one session, which then stops working, and leaves the other", async () => {
    const { email, userId, cookie } = await createVerifiedUser();
    const keep = { cookie };
    const drop = await signIn(email, { headers: { "user-agent": FIREFOX } });
    const dropped = (await sessionFromHeaders(cookieHeaders(drop.cookie)))!;

    await revokeDeviceSession(userId, dropped.sessionId);

    expect(await sessionFromHeaders(cookieHeaders(drop.cookie))).toBeNull();
    expect(await sessionFromHeaders(cookieHeaders(keep.cookie))).not.toBeNull();
  });

  it("answers not found for another user's session, and does not end it", async () => {
    const victim = await createVerifiedUser();
    const attacker = await createVerifiedUser();
    const victimSignIn = { cookie: victim.cookie };
    const victimSession = (await sessionFromHeaders(cookieHeaders(victimSignIn.cookie)))!;

    // 404, not 403: a "forbidden" would confirm the session id is real.
    await expect(revokeDeviceSession(attacker.userId, victimSession.sessionId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await sessionFromHeaders(cookieHeaders(victimSignIn.cookie))).not.toBeNull();
  });

  it("ends every other session and reports how many", async () => {
    const { email, userId, cookie } = await createVerifiedUser();
    const here = { cookie };
    const there = await signIn(email, { headers: { "user-agent": FIREFOX } });
    const elsewhere = await signIn(email);
    const current = (await sessionFromHeaders(cookieHeaders(here.cookie)))!;

    expect(await revokeOtherDeviceSessions(userId, current.sessionId)).toBe(2);
    expect(await sessionFromHeaders(cookieHeaders(here.cookie))).not.toBeNull();
    expect(await sessionFromHeaders(cookieHeaders(there.cookie))).toBeNull();
    expect(await sessionFromHeaders(cookieHeaders(elsewhere.cookie))).toBeNull();
  });
});

describe("deleting an account", () => {
  it("is refused with a wrong code, and nothing is deleted", async () => {
    const { userId, cookie } = await createVerifiedUser();
    const { headers, code } = await confirmationCode(cookie);
    const session = (await sessionFromHeaders(headers))!;
    await expect(deleteAccount(session, code === "000000" ? "111111" : "000000", headers)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await ownerQuery("select 1 from users where id = $1", [userId])).toHaveLength(1);
    expect(await sessionFromHeaders(headers)).not.toBeNull();
  });

  it("removes the account and every record that belonged to it", async () => {
    const { email, userId, cookie } = await createVerifiedUser();
    await updatePreferences(userId, { theme: "dark" });
    // One of each kind of reader record, written as the reader.
    await withUser(userId, async (tx) => {
      await tx.execute(sql`insert into user_interests (id, user_id, kind, value, label) values (gen_random_uuid(), ${userId}::uuid, 'category', 'ai', 'AI')`);
      await tx.execute(sql`insert into reader_profiles (user_id) values (${userId}::uuid)`);
      await tx.execute(sql`insert into collections (id, user_id, name) values (gen_random_uuid(), ${userId}::uuid, 'To be removed')`);
    });
    expect(await ownerQuery("select 1 from user_interests where user_id = $1", [userId])).toHaveLength(1);
    const { headers, code } = await confirmationCode(cookie);
    const session = (await sessionFromHeaders(headers))!;

    await deleteAccount(session, code, headers);

    // Read back from every table that referenced the user, as the owner.
    for (const [table, column] of [
      ["users", "id"],
      ["sessions", "user_id"],
      ["accounts", "user_id"],
      ["user_settings", "user_id"],
      ["reader_profiles", "user_id"],
      ["user_interests", "user_id"],
      ["bookmarks", "user_id"],
      ["collections", "user_id"],
      ["collection_items", "user_id"],
      ["user_story_feedback", "user_id"],
      ["reading_history", "user_id"],
      ["content_reports", "user_id"],
      ["security_events", "user_id"],
    ] as const) {
      expect(await ownerQuery(`select 1 from ${table} where ${column} = $1`, [userId]), table).toEqual([]);
    }
    expect(await sessionFromHeaders(headers)).toBeNull();
    expect(await mailCount(email, "account-deleted")).toBe(1);
    // The outbox is not tied to an account, so it is emptied of this address by hand: every message
    // sent to it before (its sign-in codes among them) is gone, and only the farewell is left.
    expect(await ownerQuery<{ template: string }>("select template from email_outbox where lower(to_email) = lower($1)", [email])).toEqual([{ template: "account-deleted" }]);
  });

  it("leaves every other account untouched", async () => {
    const leaving = await createVerifiedUser();
    const staying = await createVerifiedUser();
    const { headers, code } = await confirmationCode(leaving.cookie);
    await deleteAccount((await sessionFromHeaders(headers))!, code, headers);
    expect((await signIn(staying.email)).status).toBe(200);
  });

  it("has a cascade from every table that points at a user", async () => {
    // A table added later with a plain foreign key would make deletion fail,
    // or with none at all would leave a deleted person's data behind.
    const rows = await ownerQuery<{ table: string; column: string; rule: string }>(
      `select c.conrelid::regclass::text as "table", a.attname as "column", c.confdeltype as rule
         from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        where c.contype = 'f' and c.confrelid = 'users'::regclass`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
    /*
     * One deliberate exception: an administrator's past actions stay on the
     * audit record after their account is gone, without saying who they were.
     * Named here, column and all, so a second exception cannot slip in under it.
     */
    const exceptions = rows.filter((row) => row.rule !== "c");
    expect(exceptions).toEqual([{ table: "audit_events", column: "actor_user_id", rule: "n" }]);
  });
});
