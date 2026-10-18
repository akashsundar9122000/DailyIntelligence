import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { authFor } from "@/lib/auth/auth";
import { execRows, withSystem } from "@/lib/db/scope";

export const ORIGIN = "http://localhost:4620";

export const newEmail = () => `reader-${uuidv7()}@example.in`;

type Init = { cookie?: string; secure?: boolean; method?: "GET" | "POST"; headers?: Record<string, string> };

/** Call an authentication endpoint the way a browser on this site would. */
export async function authCall(path: string, body?: unknown, init: Init = {}) {
  const origin = init.secure ? "https://localhost:4610" : ORIGIN;
  const headers = new Headers({
    origin,
    "content-type": "application/json",
    "x-real-ip": "203.0.113.9",
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
    ...(init.secure ? { "x-forwarded-proto": "https" } : { "x-forwarded-proto": "http" }),
    ...(init.cookie ? { cookie: init.cookie } : {}),
    ...init.headers,
  });
  const method = init.method ?? (body === undefined ? "GET" : "POST");
  const request = new Request(`${origin}/api/auth${path}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const response = await authFor(headers).handler(request);
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  const setCookies = response.headers.getSetCookie();
  return {
    status: response.status,
    json: json as Record<string, unknown> | null,
    setCookies,
    /** The cookies to send back on the next request. */
    cookie: setCookies.map((value) => value.split(";")[0]).join("; "),
    headers,
  };
}

/** The newest code mailed to an address with a template, read from the outbox as the system would. */
export async function latestCode(email: string, template = "sign-in-code"): Promise<string> {
  const rows = await withSystem("test", (tx) =>
    execRows<{ text_body: string }>(
      tx,
      sql`select text_body from email_outbox where to_email = ${email} and template = ${template}
          order by created_at desc limit 1`,
    ),
  );
  const code = /\b\d{6}\b/.exec(rows[0]?.text_body ?? "")?.[0];
  if (!code) throw new Error(`No ${template} code was mailed to ${email}.`);
  return code;
}

/** Ask for a sign-in code for an address. */
export async function requestCode(email: string, init: Init = {}) {
  return authCall("/email-otp/send-verification-otp", { email, type: "sign-in" }, init);
}

/** Sign in with a fresh emailed code: the first time, this also creates the account. */
export async function signIn(email: string, init: Init = {}) {
  const sent = await requestCode(email, init);
  if (sent.status !== 200) throw new Error(`send-verification-otp answered ${sent.status}: ${JSON.stringify(sent.json)}`);
  return authCall("/sign-in/email-otp", { email, otp: await latestCode(email) }, init);
}

/** A signed-in reader. Returns the user's id and the session cookie. */
export async function createVerifiedUser(email = newEmail()) {
  const response = await signIn(email);
  if (response.status !== 200) throw new Error(`sign-in answered ${response.status}: ${JSON.stringify(response.json)}`);
  const user = (response.json?.user ?? null) as { id: string } | null;
  if (!user?.id) throw new Error("sign-in did not return the user.");
  return { email, userId: user.id, cookie: response.cookie };
}
