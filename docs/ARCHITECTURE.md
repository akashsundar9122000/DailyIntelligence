# Architecture

How a headline gets from a source to a reader, and the decisions that would be
expensive to undo. For the rules of working in the code, read `CLAUDE.md`; for
what each phase built and how it was verified, `IMPLEMENTATION_STATUS.md`.

## The shape

One Next.js 16 application (App Router, React 19) on Vercel in `sin1`, one
Postgres database on Neon in `ap-southeast-1`, and three scheduled entry points
called by a GitHub Actions workflow. No queue service, no cache service, no
second runtime: Postgres holds the work, the rate limits and the mail outbox.

```
GitHub Actions, every 15 min           Vercel, daily
  ├─ /api/cron/tick    read sources      /api/cron/daily   flush mail, retention purge
  ├─ /api/cron/enrich  the AI pass
  └─ /api/cron/notify  alerts and digests
            │
            ▼
   src/lib/ingestion ──► raw_source_items ──► stories ◄── story_scores
   src/lib/services/enrichment ──► ai_briefings, story_embeddings
   src/lib/services/notify ──► notification_events ──► web push / email outbox
            │
            ▼
   src/lib/queries (reader reads, public scope) ──► src/app pages
```

Each scheduled step is its own HTTP request with its own time budget (under
Vercel's 60 seconds), so a slow model never costs the paper a reading of its
sources, and a failing step does not stop the next one (`if: always()`).

## A headline's journey

1. **The catalogue decides what may be read** (`src/lib/sources/catalogue.ts`).
   Every source considered is listed with its terms URL, the date they were
   read, the operative quote and what they permit: headline, excerpt, AI
   summary, media, retention. Only `cleared` sources are fetched; the database
   refuses `enabled` without it. `syncCatalogue` mirrors this into `sources`
   on every tick, so a rights decision in code reaches production on the next
   tick. `docs/SOURCE_RIGHTS.md` is generated from the same file.
2. **The tick leases due sources** (`FOR UPDATE SKIP LOCKED`), reads each
   through its adapter (`src/lib/ingestion/adapters/`), and records a row in
   `ingestion_runs` whatever happens. Failures back off exponentially with a
   deterministic jitter; a 429 opens a one-hour circuit; a source that answers
   but has nothing new for longer than its kind allows is `stale`. Switches in
   `ops_switches` stop ingestion, one provider, the AI pass or notifications
   without a deploy.
3. **Rights are applied before anything is stored** (`storeItems`): no excerpt
   from a source that does not allow one, no media from anyone, excluded
   publishers dropped from GDELT rows.
4. **Clustering** puts an item in a story by trigram candidates confirmed with
   significant-word overlap or containment (`sameStory` in `normalize.ts`). It
   prefers two stories to one wrong merge; the press room suggests duplicates by
   meaning and a person merges them.
5. **Scores** (`src/lib/ranking/scores.ts`): heat, confidence and importance,
   pure functions stored with their components and a version. They are never
   combined into one number. Social conversation feeds heat only.
6. **The AI pass** writes an explainer for each story with a second publisher
   or an official source, from a bundle of only what the page may show
   (`loadBundle`). Every sentence passes `checkClaims` -- cites a record, its
   numbers are in what it cites, its names are in the bundle, official claims
   attributed -- or the output is stored `rejected` and never shown. Headlines
   are embedded for search by meaning.
7. **Pages read through `src/lib/queries/`** in public scope, every query
   joined to `showableSource()`: a source withdrawn in the press room vanishes
   from every page on the next request.

## Security model

- **Row security everywhere.** Every table has FORCE RLS; the runtime roles
  `di_app` and `di_auth` are NOBYPASSRLS. Code reaches the database only through
  `withUser`, `withPublic` or `withSystem` (`src/lib/db/scope.ts`), which set
  the session variables the policies read. A query outside a scope returns no
  rows. `withSystem` is allowed only in services, ingestion, auth, mail, jobs
  and the rate limiter (`check:guards`).
- **Every table is classified** (`src/lib/db/classification.ts`) as owner,
  reference, system or auth, and `tests/integration/isolation.conformance.test.ts`
  fails on one that is not.
- **Another reader's id answers 404**, never 403.
- **Sign-in** is an emailed six-digit code (better-auth), with Google when
  configured. Starts of a sign-in are origin-checked by us. Step-up (export,
  delete, sign out everywhere) is a fresh code.
- **Administrators** are confirmed addresses in `ADMIN_EMAILS`, checked in the
  database by every admin function; everyone else gets 404.
- **Content security policy**: a fresh nonce per page with `'strict-dynamic'`
  (`src/proxy.ts`), frames only from the two cleared social platforms.
- **Secrets** live in Vercel and in git-ignored local files; `check:secrets`
  scans everything git would commit, first in the gate. The repository is public.

## The AI layer

`src/lib/ai/`: one client (`nvidia-client.ts`) that tries models in order with
cooldowns and a per-call deadline, reasoning turned down per model family;
versioned prompts (`explainer.ts`, `briefing.ts`, `ask.ts`); one validator
(`validate.ts`); one bundle loader (`bundle.ts`). Model calls never happen
inside a database transaction. `pnpm eval:ai` runs the live model against fixed
bundles after any prompt change.

## Notifications

`src/lib/notifications/policy.ts` decides, purely: the editors' pause, the
reader's pause and choices, quality thresholds per kind (heat alone never
alerts), quiet hours in the reader's zone, a daily cap, a twelve-hour cooldown
per story. `src/lib/services/notify.ts` proposes candidates, records each
decision once per reader by dedupe key, sends web push signed with this
deployment's VAPID keys and revokes devices the push service reports gone.
"Sent" means handed over; nothing claims "delivered".

## Social Pulse

`social_posts` has no text column. A post is shown only through its platform's
own embed and linked; its significant words match it to a story; deleted posts
are dropped at the next check and nothing outlives seven days. mastodon.social
is connected; Bluesky waits for a public contact address; YouTube for an API key.

## Testing

`pnpm verify` is the gate and CI runs exactly it: secrets, tokens, layout,
contrast, guards, provenance, types, lint, unit, components, integration
(against a real local `_test` database), build, end to end (Playwright on a
production build: desktop, Pixel 7, reduced motion, axe), budget, no
placeholders. External services in the end-to-end suite are stand-ins started
by the suite (`e2e/support/model-stub.ts`: the model, embeddings and an HTTPS
push service); no product code knows it is under test. After a deploy the
read-only smoke suite runs against production.
