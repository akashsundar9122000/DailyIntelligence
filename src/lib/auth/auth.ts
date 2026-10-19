import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";

import { brand } from "@/config/brand";
import { siteUrl } from "@/config/site";
import { appSecret } from "@/lib/crypto";
import { getAuthDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import type { SecurityEventKind } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/scope";
import { env } from "@/lib/env";
import { isSecureRequest } from "@/lib/http/request";
import { CODE_MINUTES, confirmCodeMail, emailChangeCodeMail, signInCodeMail } from "@/lib/mail/auth-mail";
import { flushMail, queueMail } from "@/lib/mail/send";
import { LIMITS, take } from "@/lib/rate-limit";

import { recordSecurityEvent } from "./security-events";

/**
 * Authentication, through Better Auth.
 *
 * Passwordless. A six-digit code mailed to the address signs a reader in, and
 * creates the account the first time; Google (and GitHub, when an app exists)
 * are the alternatives. There is no password to leak, reuse or reset, and so no
 * password reset flow to be phished through.
 *
 * The library handles identity: accounts, sessions and codes. What a signed-in
 * person may see is decided elsewhere, by the database scopes in
 * lib/db/scope.ts, from the user id this module verifies.
 */

/** An integer from the environment. Lets the e2e suite RAISE a limit; nothing here can switch one off. */
function limit(name: string, fallback: number): number {
  const raw = process.env[name];
  return raw && /^\d+$/.test(raw) && Number.parseInt(raw, 10) > 0 ? Number.parseInt(raw, 10) : fallback;
}

async function sendMail(to: string, template: string, content: Parameters<typeof queueMail>[3]): Promise<void> {
  await withSystem(`auth.mail:${template}`, (tx) => queueMail(tx, to, template, content));
  // Delivered before the response returns: a serverless function is frozen once
  // it answers, and a send left running would be cut off mid-conversation.
  await flushMail().catch(() => undefined);
}

/** Endpoints whose success is worth a line in the account's security log. */
const EVENT_FOR_PATH: Record<string, SecurityEventKind> = {
  "/sign-out": "signed_out",
  "/revoke-session": "session_revoked",
  "/revoke-other-sessions": "other_sessions_revoked",
  "/revoke-sessions": "other_sessions_revoked",
};

const productionHost = new URL(siteUrl).host;

/**
 * The hosts this deployment answers on, and no others.
 *
 * Not "*.vercel.app": anybody can put a site at a vercel.app address, and a
 * trusted host is one whose pages may make authenticated requests and be
 * redirected to after sign-in. The production host, and the two addresses the
 * platform gives THIS deployment (its own, and its branch's).
 */
function trustedHosts(): string[] {
  const own = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter((host): host is string => Boolean(host && /^[a-z0-9.-]+$/i.test(host)));
  return [...new Set([productionHost, ...own])];
}

/** Paths that mail a code to the address given, and paths that check one. Limited per address as well as per caller. */
const CODE_SEND_PATHS = new Set(["/email-otp/send-verification-otp"]);

/**
 * Paths that START a session or mail a code. Their requests carry no session
 * cookie yet, so the library's cookie-based origin check does not look at
 * them -- and the email-code sign-in is a plugin route its login-forgery check
 * does not cover. Without the check below, another site could post the
 * attacker's own address and code from a victim's browser and sign the victim
 * in to the attacker's account (login forgery), and everything they then read
 * and saved would land there.
 */
const SESSION_STARTING_PATHS = ["/sign-in/", "/email-otp/"];

/** Whether a request's own origin, as the browser stated it, is one this instance serves. */
function originAllowed(origin: string | null, secure: boolean): boolean {
  if (!origin) return true; // a same-origin navigation or a server-to-server call; the fetch-metadata check below still applies
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (secure) return trustedHosts().includes(host);
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}
const CODE_CHECK_PATHS = new Set(["/sign-in/email-otp", "/email-otp/verify-email", "/email-otp/check-verification-otp"]);

/** Only the providers whose credentials are present. A half-configured provider is none. */
function socialProviders() {
  const e = env();
  return {
    ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } } : {}),
    ...(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET ? { github: { clientId: e.GITHUB_CLIENT_ID, clientSecret: e.GITHUB_CLIENT_SECRET } } : {}),
  };
}

/** Which sign-in buttons to draw. Read on the server and passed down; the secrets never are. */
export function configuredProviders(): { google: boolean; github: boolean } {
  const providers = socialProviders();
  return { google: "google" in providers, github: "github" in providers };
}

function create(secure: boolean) {
  return betterAuth({
    appName: brand.name,
    secret: appSecret(),

    /*
     * The origin is resolved per request from an allow-list, and the protocol is
     * FIXED per instance. That fixed protocol is what decides the cookies'
     * Secure flag (and their __Secure- prefix), so the flag follows the
     * transport this instance serves and never NODE_ENV: a production build
     * served over plain http must not set Secure cookies, or Safari drops them
     * and sign-in loops back to the sign-in page with nothing in any log.
     *
     * The plain-http instance answers only for a local host and has no
     * fallback, so it cannot be talked into serving any other origin.
     */
    baseURL: secure
      ? { allowedHosts: trustedHosts(), protocol: "https", fallback: siteUrl }
      : { allowedHosts: ["localhost:*", "127.0.0.1:*", "localhost", "127.0.0.1"], protocol: "http" },

    database: drizzleAdapter(getAuthDb(), {
      provider: "pg",
      /*
       * Keyed by the RENAMED model names below, not the library's defaults.
       * A mismatch logs "missing tables" at runtime, on first use, not at build.
       */
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
        auth_rate_limits: schema.authRateLimits,
      },
    }),

    advanced: {
      // uuidv7, so identity ids are the same shape as every other id and can be
      // referenced by uuid foreign keys.
      database: { generateId: () => uuidv7() },
      cookiePrefix: "di",
      /*
       * Stated, not defaulted. Left unset, the library turns origin checking
       * OFF whenever it detects a test environment, so a test suite would
       * exercise a configuration that never ships and could not notice the
       * protection being lost. Both are on everywhere.
       */
      disableOriginCheck: false,
      disableCSRFCheck: false,
      // The address is taken from the platform's header, which a client cannot set.
      ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
    },

    user: { modelName: "users" },
    session: {
      modelName: "sessions",
      additionalFields: {
        // Stamped only by lib/auth/step-up.ts, never accepted from a client.
        stepUpAt: { type: "date", required: false, input: false },
      },
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // No cookie cache: a revoked session and an expired step-up must stop
      // working on the next request, not when a cached copy runs out.
    },
    verification: { modelName: "verifications" },

    // No passwords at all. Stated rather than left to a default.
    emailAndPassword: { enabled: false },

    account: {
      modelName: "accounts",
      /*
       * Google may sign in to an account first made with an emailed code, but
       * only because Google has verified the same address. Linking on an
       * UNverified provider address would let anybody who registers that
       * address elsewhere walk into the account.
       */
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },

    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_MINUTES * 60,
        // Three guesses at a six-digit code, then the code is burned.
        allowedAttempts: 3,
        storeOTP: "hashed",
        overrideDefaultEmailVerification: true,
        // The first code to an address creates its account. Signing in with a
        // code also proves the address, so there is no separate verification step.
        disableSignUp: false,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") await sendMail(email, "sign-in-code", signInCodeMail(otp));
          else if (type === "change-email") await sendMail(email, "email-change", emailChangeCodeMail(otp));
          else await sendMail(email, "confirm-code", confirmCodeMail(otp));
        },
      }),
    ],

    socialProviders: socialProviders(),

    rateLimit: {
      enabled: true,
      // In the database: an in-memory counter is per serverless instance, which
      // under any real load is no limit at all.
      storage: "database",
      modelName: "auth_rate_limits",
      window: 60,
      max: limit("AUTH_LIMIT_DEFAULT", 60),
      customRules: {
        /*
         * Per address, and an address is not a person: an office or a mobile
         * carrier's NAT is one address for hundreds of people. These stop a
         * script, not a household. The real protection against guessing a code
         * is the three-attempt cap on the code itself.
         */
        "/email-otp/send-verification-otp": { window: 60, max: limit("AUTH_LIMIT_CODE", 6) },
        "/sign-in/email-otp": { window: 60, max: limit("AUTH_LIMIT_CODE", 10) },
        "/email-otp/check-verification-otp": { window: 60, max: limit("AUTH_LIMIT_CODE", 10) },
        "/sign-in/social": { window: 60, max: limit("AUTH_LIMIT_SIGN_IN", 10) },
      },
    },

    databaseHooks: {
      session: {
        create: {
          async after(session) {
            await recordSecurityEvent(session.userId, "signed_in", { ip: session.ipAddress, userAgent: session.userAgent });
          },
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.request?.method === "POST" && SESSION_STARTING_PATHS.some((prefix) => ctx.path.startsWith(prefix))) {
          const crossSite = ctx.headers?.get("sec-fetch-site") === "cross-site";
          if (crossSite || !originAllowed(ctx.headers?.get("origin") ?? null, secure)) {
            throw new APIError("FORBIDDEN", { message: "This request did not come from this site." });
          }
        }

        /*
         * Over HTTP, only a SIGN-IN code may be asked for. With sign-up on,
         * every address gets a sign-in code, so its answer says nothing; any
         * other type answers at once for an unknown address and only after a
         * mail is sent for a known one -- a stopwatch tells which addresses
         * have accounts. Step-up asks for its code from the server, through
         * auth.api, where there is no request, and is unaffected.
         */
        if (ctx.request && CODE_SEND_PATHS.has(ctx.path) && ctx.body?.type !== "sign-in") {
          throw new APIError("BAD_REQUEST", { message: "Ask for a sign-in code." });
        }

        /*
         * A cap per ACCOUNT on asking for a code and on trying one. The
         * library's own limits are per address of the caller, and every new
         * code resets its three guesses: together that lets a caller with many
         * addresses guess at one account's reset code without end, and lets
         * anybody flood an inbox. Counted before the library does any work,
         * and whether or not the address has an account, so the answer says
         * nothing about that.
         */
        const address = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase().slice(0, 320) : "";
        const rule = CODE_SEND_PATHS.has(ctx.path) ? ("codeSendPerEmail" as const) : CODE_CHECK_PATHS.has(ctx.path) ? ("codeCheckPerEmail" as const) : null;
        if (rule && address) {
          // Guesses at a code fail closed: a counter outage must not become unlimited guessing.
          const taken = await take(`${rule}:${address}`, LIMITS[rule], undefined, { failClosed: rule === "codeCheckPerEmail" });
          if (!taken.ok) throw new APIError("TOO_MANY_REQUESTS", { message: "Too many attempts for this address. Please wait an hour and try again." });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const kind = EVENT_FOR_PATH[ctx.path];
        if (!kind) return;
        // The hook also runs for a refused request. Only a success is an event.
        if (ctx.context.returned instanceof Error) return;

        const context = { ip: ctx.headers?.get("x-real-ip"), userAgent: ctx.headers?.get("user-agent") };
        const userId = (ctx.context.newSession?.user ?? ctx.context.session?.user)?.id;
        if (!userId) return;
        await recordSecurityEvent(userId, kind, context);
      }),
    },
  });
}

export type Auth = ReturnType<typeof create>;

const instances: { secure?: Auth; plain?: Auth } = {};

/**
 * The instance for this request's transport.
 *
 * Two instances, because the library fixes the cookies' Secure flag when it is
 * created, and the flag has to follow the request. On a deployment every
 * request is https, so only the secure instance is ever built there.
 */
export function authFor(headers: { get(name: string): string | null }): Auth {
  if (isSecureRequest(headers, siteUrl)) return (instances.secure ??= create(true));
  return (instances.plain ??= create(false));
}
