import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { newEmail } from "./auth-helpers";

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  await (await import("@/lib/db/client")).closeDb();
});

/** An address no other test, and no earlier run, has used. */
let counter = 0;
const uniqueIp = () => {
  counter += 1;
  const stamp = Date.now();
  return `198.${18 + (counter % 2)}.${(stamp >> 8) & 255}.${(stamp + counter) & 255}`;
};

/** A fresh copy of the auth module, configured with the limits a deployment runs with. */
async function withLimits(vars: Record<string, string>) {
  vi.resetModules();
  for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value);
  const { authFor } = await import("@/lib/auth/auth");
  return async (path: string, body: unknown, ip: string) => {
    const headers = new Headers({ origin: "http://localhost:4620", "content-type": "application/json", "x-forwarded-proto": "http", "x-real-ip": ip });
    return authFor(headers).handler(new Request(`http://localhost:4620/api/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
  };
}

describe("authentication rate limits", () => {
  it("refuse code requests from one address past the limit, and only that address", async () => {
    const call = await withLimits({ AUTH_LIMIT_CODE: "3", AUTH_LIMIT_CODE_PER_EMAIL: "500" });
    const attacker = uniqueIp();
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await call("/email-otp/send-verification-otp", { email: newEmail(), type: "sign-in" }, attacker)).status);
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses.slice(3)).toEqual([429, 429]);
    // Somebody else, somewhere else, is not locked out by it.
    expect((await call("/email-otp/send-verification-otp", { email: newEmail(), type: "sign-in" }, uniqueIp())).status).toBe(200);
  });

  it("hold across instances, because the count is in the database and not in memory", async () => {
    const ip = uniqueIp();
    const first = await withLimits({ AUTH_LIMIT_CODE: "2", AUTH_LIMIT_CODE_PER_EMAIL: "500" });
    for (let i = 0; i < 2; i++) await first("/email-otp/send-verification-otp", { email: newEmail(), type: "sign-in" }, ip);
    // A second module instance stands in for a second serverless function.
    const second = await withLimits({ AUTH_LIMIT_CODE: "2", AUTH_LIMIT_CODE_PER_EMAIL: "500" });
    const refused = await second("/email-otp/send-verification-otp", { email: newEmail(), type: "sign-in" }, ip);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("x-retry-after") ?? refused.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("limits that are per account, not per caller", () => {
  it("stop codes being asked for one address from many callers, and treat capitals as the same address", async () => {
    // The library's own limit is raised out of the way: what is tested is the cap on the ADDRESS, which
    // stops anyone filling a stranger's inbox from a thousand addresses.
    const call = await withLimits({ AUTH_LIMIT_CODE_PER_EMAIL: "3", AUTH_LIMIT_CODE: "5000" });
    const email = newEmail();
    const forms = [email, email.toUpperCase(), ` ${email} `, email, email];
    const statuses = [];
    // A different caller every time: a per-caller limit would never bite.
    for (const form of forms) statuses.push((await call("/email-otp/send-verification-otp", { email: form, type: "sign-in" }, uniqueIp())).status);
    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });

  it("stop a code being guessed at for one address from many callers", async () => {
    // Every new code resets its own three guesses; without a cap per address, many callers could keep asking and guessing.
    const call = await withLimits({ AUTH_LIMIT_CHECK_PER_EMAIL: "4", AUTH_LIMIT_CODE: "5000" });
    const email = newEmail();
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await call("/sign-in/email-otp", { email, otp: String(100000 + i) }, uniqueIp())).status);
    expect(statuses.slice(0, 4).every((status) => status !== 429)).toBe(true);
    expect(statuses.slice(4)).toEqual([429, 429]);
  });
});
