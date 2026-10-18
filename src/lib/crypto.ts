import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/*
 * Present only so a fresh clone works. It is public by definition -- it is in
 * the repository -- so production refuses to fall back to it.
 */
const DEVELOPMENT_SECRET = "development-only-secret-not-for-any-deployment";

export function appSecret(): string {
  const e = env();
  if (e.APP_SECRET) return e.APP_SECRET;
  if (e.NODE_ENV === "production") {
    throw new Error("APP_SECRET is not set. Production will not sign or hash with a development key.");
  }
  return DEVELOPMENT_SECRET;
}

/**
 * A keyed hash, namespaced by purpose so a value hashed for one use can never
 * be replayed as another. Used wherever a table must be able to recognise a
 * value without storing it.
 */
export function hmac(purpose: string, value: string): string {
  return createHmac("sha256", appSecret()).update(`${purpose}\u0000${value}`).digest("hex");
}

/** Constant-time comparison. `===` on secrets leaks how many leading characters matched. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
