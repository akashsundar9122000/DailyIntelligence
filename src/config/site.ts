import { brand } from "./brand";

/**
 * The public origin, for canonical URLs and link previews.
 *
 * In order: an explicit NEXT_PUBLIC_APP_URL; the production domain Vercel
 * reports for this project; the local fallback. The middle step means a fresh
 * deployment has correct metadata without anybody having to learn its URL and
 * set a variable first -- a canonical pointing at localhost is invisible on the
 * page and wrong in every search result.
 *
 * NEXT_PUBLIC_* is inlined at build time and is safe in the browser; nothing
 * secret may ever take that prefix.
 */
export function resolveSiteUrl(vars: { NEXT_PUBLIC_APP_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string }): string {
  if (vars.NEXT_PUBLIC_APP_URL) return vars.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (vars.VERCEL_PROJECT_PRODUCTION_URL) return `https://${vars.VERCEL_PROJECT_PRODUCTION_URL}`;
  return brand.fallbackUrl;
}

export const siteUrl: string = resolveSiteUrl({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
