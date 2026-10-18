/**
 * The one place the product's name, tagline and identity assets are written.
 *
 * Everything else -- metadata, the masthead, emails, the manifest -- reads from
 * here, and scripts/check-guards.mjs fails the gate if the name is typed out
 * anywhere else under src/. If the name has to change, it changes in one file.
 */
export const brand = {
  name: "Daily Intelligence",
  /** The masthead's short form, for the phone bar and the app icon label. */
  shortName: "Daily Intel",
  tagline: "Know what matters. Understand why.",
  description:
    "A personalised news intelligence desk for India and the world: rights-checked sources, stories clustered across publishers, heat kept apart from confidence, and AI explainers that cite every claim.",

  /*
   * Versioned paths under public/, not app/icon.svg. Next hashes a file-convention
   * icon's URL from its route rather than its content, so a redrawn mark keeps
   * the old URL and browsers keep the old favicon. A new mark gets a new path.
   */
  assets: {
    mark: "/brand/mark-v1.svg",
    markInverse: "/brand/mark-inverse-v1.svg",
    icon192: "/brand/icon-192-v1.png",
    icon512: "/brand/icon-512-v1.png",
    maskable: "/brand/icon-maskable-v1.png",
    appleTouch: "/brand/apple-touch-v1.png",
  },

  locale: "en-IN",
  /** Presentation timezone. Every timestamp is stored in UTC and converted only when drawn. */
  timeZone: "Asia/Kolkata",
  /** Used only when NEXT_PUBLIC_APP_URL is unset, so metadata never renders a relative canonical. */
  fallbackUrl: "http://localhost:4610",
} as const;

export type Brand = typeof brand;
