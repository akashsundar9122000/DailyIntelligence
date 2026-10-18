import "server-only";

import { z } from "zod";

/**
 * Server environment, parsed once.
 *
 * Every variable is optional and has a tested absence path: a fresh clone runs
 * with an empty .env.local. A value that IS present and malformed fails loudly
 * here, naming the variable and never printing what it held.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** "1" exposes /dev/* in a production build. The e2e suite sets it; a deployment does not. */
  APP_DEV_TOOLS: z.enum(["0", "1"]).optional(),

  /**
   * The RUNTIME role's connection string (di_app: no ownership, no RLS
   * bypass). Never the owner's. Absent, every data-backed screen shows an
   * unavailable state instead of failing.
   */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),

  /**
   * The authentication library's connection string (di_auth). The only
   * role with access to credentials, and used by nothing else.
   */
  DATABASE_URL_AUTH: z.url({ protocol: /^postgres(ql)?$/ }).optional(),

  /** Optional "Continue with Google". Absent, the button is not shown. */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  /** Keys every HMAC and signed value. Absent, a fixed development key is used
   *  outside production and production refuses to sign anything. */
  APP_SECRET: z.string().min(32).optional(),

  /**
   * "1" shows the SAMPLE edition -- invented stories, every one badged
   * "Sample" under a banner saying it is not live news -- on a deployment.
   * It opens nothing else: the design reference pages and the mail outbox
   * stay off. Absent, a deployment shows only ingested stories from cleared
   * sources, or an honest empty state.
   */
  DEMO_MODE: z.enum(["0", "1"]).optional(),

  /**
   * The email addresses that may open the administrator's pages, separated by
   * commas. Absent, nobody is an administrator and those pages do not exist
   * for anyone. An address here is not enough alone: the account must also
   * have confirmed that address.
   */
  ADMIN_EMAILS: z.string().min(3).optional(),

  /**
   * Shared with the scheduler, which sends it as a bearer token. Absent, the
   * scheduled endpoints refuse every caller: an unprotected job endpoint is a
   * way for anybody to make the server do work.
   */
  CRON_SECRET: z.string().min(24).optional(),

  /**
   * Hosted inference for summaries, explainers and briefings. Server-side only.
   * Absent, every story falls back to a non-generative summary built from its
   * source metadata; ingestion and the feed do not depend on it.
   * NVIDIA_MODEL is a comma-separated list in order of preference: a model
   * being retired is then a configuration change, not a deploy.
   */
  NVIDIA_API_KEY: z.string().min(10).optional(),
  NVIDIA_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),
  NVIDIA_MODEL: z.string().min(1).optional(),

  /**
   * GDELT's endpoints. Public and keyless; configurable so the tests can point
   * them at recorded fixtures and never touch the network.
   */
  GDELT_DOC_API_URL: z.url().default("https://api.gdeltproject.org/api/v2/doc/doc"),
  GDELT_LASTUPDATE_URL: z.url().default("https://data.gdeltproject.org/gdeltv2/lastupdate.txt"),

  /** Optional. Absent, the YouTube source is "not configured" and is never called. */
  YOUTUBE_API_KEY: z.string().min(10).optional(),

  /**
   * Optional Bluesky app password, for topic search. Following public
   * accounts needs no credential; search does. Both or neither.
   */
  BSKY_HANDLE: z.string().min(3).optional(),
  BSKY_APP_PASSWORD: z.string().min(8).optional(),

  /** Optional "Continue with GitHub". Absent, the button is not shown. */
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Web push. The public key is handed to the browser by an endpoint, not
   * inlined as NEXT_PUBLIC_, so all three stay together and the private one
   * never comes near a client bundle. Absent, push is "not available".
   */
  WEB_PUSH_PUBLIC_KEY: z.string().min(20).optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().min(20).optional(),
  WEB_PUSH_SUBJECT: z.string().min(6).optional(),

  /**
   * Outbound mail. All four of host, user, password and sender must be present
   * for anything to be sent; otherwise messages are recorded in the outbox with
   * status DEV and delivered nowhere.
   */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  // A blank line in an env file (`APP_SECRET=`) arrives as "", which is not the
  // same as absent to a validator. Treat it as unset, as the file's author meant.
  const present = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ""));
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${names}. Check .env.local against .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** The design reference pages. On in development, off in production unless opted in. */
export function devToolsEnabled(): boolean {
  const e = env();
  return e.NODE_ENV !== "production" || e.APP_DEV_TOOLS === "1";
}

/**
 * Whether the SAMPLE edition may be shown. Only by name: sample stories are
 * never shown merely because the development tools are on, because a page that mixes a sample story into a
 * live feed is exactly the fabrication this product exists to avoid. The demo
 * provider is the only reader of the fixtures (check:provenance).
 */
export function demoModeEnabled(): boolean {
  return env().DEMO_MODE === "1";
}

/**
 * The page that shows recorded mail, one-time codes included. It needs the
 * development tools AND a server that is not a hosted deployment: the same
 * flag also makes sample data showable, which is an ordinary thing to want on
 * a demo, and must never be the thing that publishes everybody's sign-in codes.
 */
export function devOutboxEnabled(): boolean {
  return devToolsEnabled() && !process.env.VERCEL;
}

/** True only when mail can actually leave. A partial configuration is treated as none. */
export function smtpConfigured(): boolean {
  const e = env();
  return Boolean(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS && e.MAIL_FROM);
}

/** True when the AI layer has a key to call its model with. */
export function aiConfigured(): boolean {
  return Boolean(env().NVIDIA_API_KEY);
}

/** True when the YouTube source has a key. */
export function youtubeConfigured(): boolean {
  return Boolean(env().YOUTUBE_API_KEY);
}

/** True when Bluesky search has both halves of its credential. Half a configuration is none. */
export function blueskySearchConfigured(): boolean {
  const e = env();
  return Boolean(e.BSKY_HANDLE && e.BSKY_APP_PASSWORD);
}

/** True when all three web push values are present. */
export function webPushConfigured(): boolean {
  const e = env();
  return Boolean(e.WEB_PUSH_PUBLIC_KEY && e.WEB_PUSH_PRIVATE_KEY && e.WEB_PUSH_SUBJECT);
}

/** The administrators' addresses, lower-cased. Empty when none is configured. */
export function adminEmails(): string[] {
  return (env().ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.includes("@"));
}
