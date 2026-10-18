import { sql } from "drizzle-orm";
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

import { listSecurityEvents } from "@/lib/auth/security-events";
import { sessionFromHeaders } from "@/lib/auth/session";
import { hasRecentStepUp, sendStepUpCode, stepUpWithCode, STEP_UP_WINDOW_MS } from "@/lib/auth/step-up";
import { closeDb } from "@/lib/db/client";
import { execRows, withSystem, withUser } from "@/lib/db/scope";

import { authCall, createVerifiedUser, latestCode, newEmail, requestCode, signIn } from "./auth-helpers";

afterAll(async () => {
  await closeDb();
});

const cookieHeaders = (cookie: string) =>
  new Headers({ cookie, "x-forwarded-proto": "http", host: "localhost:4620", "x-real-ip": "203.0.113.9" });

describe("signing in with an emailed code", () => {
  it("creates the account on first use, confirms the address, and opens a session", async () => {
    const email = newEmail();
    const response = await signIn(email);
    expect(response.status).toBe(200);
    const user = response.json?.user as { id: string; email: string; emailVerified: boolean };
    expect(user.email).toBe(email);
    // Having received the code proves the inbox: there is no separate confirmation step.
    expect(user.emailVerified).toBe(true);
    const session = await sessionFromHeaders(cookieHeaders(response.cookie));
    expect(session?.user.id).toBe(user.id);
    expect(session?.user.emailVerified).toBe(true);
  });

  it("signs the same account in again, rather than making a second one", async () => {
    const { email, userId } = await createVerifiedUser();
    const again = await signIn(email);
    expect((again.json?.user as { id: string }).id).toBe(userId);
    const accounts = await withSystem("test", (tx) => execRows(tx, sql`select 1 from users where lower(email) = lower(${email})`));
    expect(accounts).toHaveLength(1);
  });

  it("answers a request for a code the same way whether or not the address has an account", async () => {
    const existing = await createVerifiedUser();
    const known = await requestCode(existing.email);
    const unknown = await requestCode(newEmail());
    expect(known.status).toBe(unknown.status);
    expect(known.json).toEqual(unknown.json);
  });

  it("refuses a wrong code and opens nothing", async () => {
    const email = newEmail();
    await requestCode(email);
    const wrong = await authCall("/sign-in/email-otp", { email, otp: "000000" === (await latestCode(email)) ? "111111" : "000000" });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    expect(wrong.setCookies.join(";")).not.toContain("session_token");
  });

  it("burns a code after three wrong guesses, so the right one no longer works", async () => {
    const email = newEmail();
    await requestCode(email);
    const code = await latestCode(email);
    const wrong = code === "123456" ? "654321" : "123456";
    for (let attempt = 0; attempt < 3; attempt += 1) await authCall("/sign-in/email-otp", { email, otp: wrong });
    const right = await authCall("/sign-in/email-otp", { email, otp: code });
    expect(right.status).toBeGreaterThanOrEqual(400);
  });

  it("stores the code hashed, so the database cannot be used to read it", async () => {
    const email = newEmail();
    await requestCode(email);
    const code = await latestCode(email);
    const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
    await owner.connect();
    const { rows } = await owner.query("select value from verifications where identifier like $1", [`%${email}%`]);
    await owner.end();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(String(row.value)).not.toContain(code);
  });

  it("never accepts a password: there is none to guess", async () => {
    const { email } = await createVerifiedUser();
    const attempt = await authCall("/sign-in/email", { email, password: "anything-at-all-123" });
    expect(attempt.status).toBeGreaterThanOrEqual(400);
    expect(attempt.setCookies.join(";")).not.toContain("session_token");
  });

  it("resolves no session without a cookie, or with a forged one", async () => {
    // A real request always names its host; what it lacks here is a cookie.
    expect(await sessionFromHeaders(new Headers({ host: "localhost:4620", "x-forwarded-proto": "http" }))).toBeNull();
    expect(await sessionFromHeaders(cookieHeaders("di.session_token=forged.value"))).toBeNull();
  });

  it("stops resolving the moment the session is signed out", async () => {
    const { cookie } = await createVerifiedUser();
    expect(await sessionFromHeaders(cookieHeaders(cookie))).not.toBeNull();
    const out = await authCall("/sign-out", {}, { cookie });
    expect(out.status).toBe(200);
    expect(await sessionFromHeaders(cookieHeaders(cookie))).toBeNull();
  });
});

describe("the session cookie", () => {
  it("is not marked Secure over plain http, even in a production build", async () => {
    // Safari drops a Secure cookie sent over http; sign-in would then loop.
    const response = await signIn(newEmail());
    const cookie = response.setCookies.find((value) => value.includes("session_token"))!;
    expect(cookie).toMatch(/^di\.session_token=/);
    expect(cookie.toLowerCase()).not.toContain("secure");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
  });

  it("is marked Secure, with the __Secure- prefix, over https", async () => {
    const response = await signIn(newEmail(), { secure: true });
    expect(response.status).toBe(200);
    const cookie = response.setCookies.find((value) => value.includes("session_token"))!;
    expect(cookie).toMatch(/^__Secure-di\.session_token=/);
    expect(cookie.toLowerCase()).toContain("secure");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("refuses another site acting through a signed-in browser", async () => {
    // The forgery that matters: the victim's browser attaches their session
    // cookie to a request another site initiated.
    const { cookie } = await createVerifiedUser();
    const forged = await authCall("/sign-out", {}, { cookie, headers: { origin: "https://evil.example" } });
    expect(forged.status).toBe(403);
    // And the session is still there: nothing was done.
    expect(await sessionFromHeaders(cookieHeaders(cookie))).not.toBeNull();
  });

  it("refuses a request with a session cookie and no origin at all", async () => {
    const { cookie } = await createVerifiedUser();
    const headers = new Headers({ cookie, "content-type": "application/json", "x-forwarded-proto": "http" });
    const { authFor } = await import("@/lib/auth/auth");
    const response = await authFor(headers).handler(new Request("http://localhost:4620/api/auth/sign-out", { method: "POST", headers, body: "{}" }));
    expect(response.status).toBe(403);
  });

  it("refuses a sign-in posted by a form on another site", async () => {
    // Login forgery: no cookie yet, so the browser's own fetch metadata is what
    // identifies the request as cross-site.
    const email = newEmail();
    await requestCode(email);
    const response = await authCall(
      "/sign-in/email-otp",
      { email, otp: await latestCode(email) },
      { headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" } },
    );
    expect(response.status).toBe(403);
    expect(response.setCookies.join(";")).not.toContain("session_token");
  });
});

describe("step-up", () => {
  it("treats a new sign-in as proof, then asks again once it is old", () => {
    const now = new Date();
    expect(hasRecentStepUp({ createdAt: now, stepUpAt: null }, now)).toBe(true);
    const old = new Date(now.getTime() - STEP_UP_WINDOW_MS - 1000);
    expect(hasRecentStepUp({ createdAt: old, stepUpAt: null }, now)).toBe(false);
    expect(hasRecentStepUp({ createdAt: old, stepUpAt: now }, now)).toBe(true);
  });

  it("stamps the session when a fresh emailed code is right, and the stamp is there when read back", async () => {
    const { cookie, userId } = await createVerifiedUser();
    const headers = cookieHeaders(cookie);
    const session = (await sessionFromHeaders(headers))!;
    expect(session.stepUpAt).toBeNull();
    await sendStepUpCode(session, headers);
    await stepUpWithCode(session, await latestCode(session.user.email, "confirm-code"), headers);
    const reread = (await sessionFromHeaders(headers))!;
    expect(reread.stepUpAt).not.toBeNull();
    const { events } = await listSecurityEvents(userId);
    expect(events[0]!.kind).toBe("step_up");
  });

  it("refuses a wrong code and leaves the session unstamped", async () => {
    const { cookie } = await createVerifiedUser();
    const headers = cookieHeaders(cookie);
    const session = (await sessionFromHeaders(headers))!;
    await sendStepUpCode(session, headers);
    const code = await latestCode(session.user.email, "confirm-code");
    await expect(stepUpWithCode(session, code === "000000" ? "111111" : "000000", headers)).rejects.toMatchObject({ code: "VALIDATION" });
    expect((await sessionFromHeaders(headers))!.stepUpAt).toBeNull();
  });
});

describe("the security log", () => {
  it("records a sign-in with coarse context only", async () => {
    const { userId } = await createVerifiedUser();
    const { events, intact } = await listSecurityEvents(userId);
    expect(events.map((event) => event.kind)).toEqual(["signed_in"]);
    expect(intact).toBe(true);
    // A network prefix and a browser family. Not an address, not a full user agent.
    expect(events[0]!.detail).toEqual({ network: "203.0.x.x", device: "Chrome on macOS" });
    expect(events[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("detects a row that was edited after the fact", async () => {
    const { email, userId } = await createVerifiedUser();
    await signIn(email);
    expect((await listSecurityEvents(userId)).intact).toBe(true);
    // Only the owner can do this at all; the point is that it does not go unnoticed.
    const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
    await owner.connect();
    await owner.query("update security_events set kind = 'signed_out' where seq = (select min(seq) from security_events where user_id = $1)", [userId]);
    await owner.end();
    expect((await listSecurityEvents(userId)).intact).toBe(false);
  });

  it("detects a row that was removed", async () => {
    const { email, userId } = await createVerifiedUser();
    await signIn(email);
    await signIn(email);
    const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST_OWNER });
    await owner.connect();
    await owner.query("delete from security_events where seq = (select min(seq) from security_events where user_id = $1)", [userId]);
    await owner.end();
    expect((await listSecurityEvents(userId)).intact).toBe(false);
  });

  it("cannot be written, edited or deleted by the user it describes", async () => {
    const { userId } = await createVerifiedUser();
    await expect(
      withUser(userId, (tx) => tx.execute(sql`insert into security_events (id, user_id, kind) values (gen_random_uuid(), ${userId}::uuid, 'signed_in')`)),
    ).rejects.toThrow();
    const changed = await withUser(userId, async (tx) => {
      await tx.execute(sql`update security_events set kind = 'signed_out' where user_id = ${userId}::uuid`);
      await tx.execute(sql`delete from security_events where user_id = ${userId}::uuid`);
      return execRows<{ kind: string }>(tx, sql`select kind from security_events where user_id = ${userId}::uuid order by seq`);
    });
    // Both statements matched no rows: the log is as it was.
    expect(changed.map((row) => row.kind)).toEqual(["signed_in"]);
  });

  it("is invisible to another user", async () => {
    const first = await createVerifiedUser();
    const second = await createVerifiedUser();
    const seen = await withUser(second.userId, (tx) => execRows(tx, sql`select 1 from security_events where user_id = ${first.userId}::uuid`));
    expect(seen).toEqual([]);
  });
});

describe("who can read identity data", () => {
  it("lets a user read their own account row and nobody else's", async () => {
    const first = await createVerifiedUser();
    const second = await createVerifiedUser();
    const seen = await withUser(first.userId, (tx) => execRows<{ id: string }>(tx, sql`select id from users`));
    expect(seen).toEqual([{ id: first.userId }]);
    expect(seen.map((row) => row.id)).not.toContain(second.userId);
  });

  it("hides codes, OAuth tokens and the library's counters from the application, even as the system", async () => {
    await createVerifiedUser();
    for (const table of ["accounts", "verifications", "auth_rate_limits"]) {
      const rows = await withSystem("test", (tx) => execRows(tx, sql.raw(`select 1 from ${table}`)));
      expect(rows, table).toEqual([]);
    }
  });

  it("hides session tokens from other users", async () => {
    const first = await createVerifiedUser();
    const second = await createVerifiedUser();
    const seen = await withUser(second.userId, (tx) => execRows(tx, sql`select 1 from sessions where user_id = ${first.userId}::uuid`));
    expect(seen).toEqual([]);
  });

  it("gives the authentication role no access to anything outside identity", async () => {
    const auth = new pg.Client({ connectionString: process.env.DATABASE_URL_AUTH });
    await auth.connect();
    for (const table of ["job_runs", "email_outbox", "rate_limits", "security_events", "sources", "stories", "user_interests", "bookmarks"]) {
      await expect(auth.query(`select 1 from ${table}`), table).rejects.toMatchObject({ code: "42501" });
    }
    const { rows } = await auth.query("select rolbypassrls, rolsuper from pg_roles where rolname = current_user");
    await auth.end();
    expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });
});
