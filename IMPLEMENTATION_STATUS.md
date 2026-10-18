# Implementation status

What is built, what was verified (only checks that were actually run), and
what is outstanding. Updated at the end of every phase.

The plan is `docs/plan.md`; the scope is `docs/BLUEPRINT.md`.

| Phase | Scope | State |
|---|---|---|
| 0 | Repository, newspaper identity, shell, sign-in, database security, the gate, first deploy | Done, deployed |
| 1 | Sources, ingestion, clustering, scores, the editions, story page, search, saved, onboarding, settings, admin | Done (see below for the deploy check) |
| 2 | AI explainers with citations, AI category tagging, briefings, ask about a story, eval set | Not started |
| 3 | Live updates, web push, notification policy, digests | Not started |
| 4 | Social Pulse, dashboards, admin cluster tools and moderation, semantic search | Not started |
| 5 | Visual explainers, AI cost caps, editorial review, retention purge, hardening, final docs | Not started |

## Phase 0

- Next.js 16 App Router, React 19, Tailwind v4 tokens (newsprint day, night
  edition, high contrast), the ink mark and serif masthead.
- Passwordless sign-in by emailed code, Google when configured, step-up by a
  fresh code for export, deletion and signing out everywhere.
- Postgres with FORCE row security on every table; the runtime roles `di_app`
  and `di_auth` cannot bypass it.
- The gate (`pnpm verify`) runs in CI on every push.
- Verified in production: `/api/health` reports `di_app`, row security
  enforced and the deployed commit; the production smoke suite passed 22 of 22;
  one real sign-in email was delivered through SMTP.

## Phase 1

Built:

- **Sources** (`src/lib/sources/catalogue.ts`, `docs/SOURCE_RIGHTS.md`): GDELT
  GKG 15-minute files (headline, site, time and link only), PIB in English,
  arXiv (cs.AI, cs.CL, cs.LG, cs.CV), NASA, the Federal Reserve. RBI, SEBI, WHO,
  Bluesky and Mastodon are pending review and never fetched; six publishers
  are excluded by their terms.
- **Ingestion**: adapters for GDELT and RSS/Atom, conditional requests, rights
  stripping before storage, idempotent upserts, backoff and a circuit breaker,
  leasing with `FOR UPDATE SKIP LOCKED`, a run row per source per tick.
- **Clustering**: trigram candidates confirmed by shared significant words
  (overlap or containment), plurals folded.
- **Scores**: heat, confidence and importance as pure functions, stored with
  their components and a version; relevance per reader with a discovery slot,
  section run limits and a per-publisher cap.
- **Screens**: For You, Today, Hot Now, India (state filters), Global (region
  filters), Categories and a front for every section, the story page (every
  source, both times, why it is hot, how well it is sourced, a rule-written
  summary), Explore (stories, sources, sections), Saved with notes and
  collections, six-step onboarding, settings tabs for interests, reading and
  data, and the admin press room (source health, runs, switch a source off).
- **Scheduling**: `.github/workflows/tick.yml` calls `/api/cron/tick` every
  15 minutes; Vercel's daily cron is the backstop.

Verified locally:

- `pnpm verify` passed: 169 unit, 36 component, 105 integration and 238
  end-to-end tests (desktop, Pixel 7, reduced motion, axe on 17 signed-in
  routes in both themes), budget and no-placeholder checks.
- A real tick against the live sources stored 267 items; a second tick stored
  none (duplicates and 304 responses), so ingestion is idempotent.
- Screenshots of the phase 1 screens in day and night at 1440px and 390px were
  read; the section header and the phone onboarding progress were fixed after
  looking at them.

Known limitations:

- A preference changed in the moment before leaving the page can be lost:
  preferences are saved a moment after the change, not on unload.
- GDELT tags a story with every country it mentions, so a few world stories
  appear in the India edition. Phase 2's category tagging is where this is
  tightened.
- arXiv publishes nothing at weekends; an empty arXiv run on a Sunday is normal.
