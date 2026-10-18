# Daily Intelligence: build plan

## Context

Daily Intelligence ("Know what matters. Understand why.") is a personalised, AI-assisted news intelligence platform for India and the world. The source of truth is the blueprint `daily_intelligence_claude_blueprint_free_sources.md`, which is copied into `docs/BLUEPRINT.md` at the start. The supplied logo is a visual reference only.

Starting state:
- `/Users/akash/Documents/DailyIntelligence` is empty and has no `.git` of its own. git there resolves to the parent `Documents` repo, whose remote is `Wedding.git`.
- GitHub `akashsundar9122000/DailyIntelligence` exists but is empty and private.
- The Vercel CLI and the GitHub CLI are both logged in.
- Local Postgres 17 is running.

The rule that shapes everything: **no fabricated news, and nothing displayed that a source's terms do not permit.** Every story on screen comes from a rights-checked source with its link, publication time and detection time. The only exception is clearly badged `Sample` content in demo mode.

## Decisions locked (from Q&A)

| Topic | Decision |
|---|---|
| Stack | Next.js 16.3.5 App Router, React 19.2.8, TS strict, Tailwind v4, Drizzle 0.45.3, zod 4, better-auth 1.7.5, vitest, Playwright and axe, pnpm. The same pins as Candlora |
| Template | **Candlora** for structure, gate, tokens, theme, shell, settings, db scopes and cron. Bookie's appearance controls. Market Place's hedged NVIDIA client |
| Audience and rights | **Public product, strict rights.** Only sources whose terms are verified for public display are shown. Unclear sources are registered `pending_review` and **never fetched** |
| Scheduler | **GitHub Actions cron every 15 min** calling a secured `/api/cron/tick`, plus a daily Vercel cron as a backstop and for digests |
| Repo | **Made public** to get unlimited Actions minutes. This happens only after `check:secrets` passes over the full history |
| Auth | Better Auth: passwordless **email OTP** for sign-in and verification, plus **Google**, reusing CodeAtlas's client (you add the redirect URIs). GitHub is wired in code but hidden until a new GitHub OAuth app exists, because a GitHub app allows only one callback URL |
| Databases | Local `dailyintel_dev` and `dailyintel_test`. Neon (the URL you gave) is production only. Runtime roles `di_app` and `di_auth` are NOBYPASSRLS. The owner URL lives in `.env.neon.local` and is never committed |
| Email | Expensify's Gmail SMTP (`smtp.gmail.com:587`). In dev, mail goes to the `/dev/outbox` page instead |
| AI | The NVIDIA key from Candlora's and Market Place's `.env.local`. Base `https://integrate.api.nvidia.com/v1`. The model list is configurable, defaulting to Market Place's list |
| YouTube | **No key exists anywhere** (CodeAtlas has none, only empty placeholders elsewhere). The connector is built, and its status shows "Not configured" until you add `YOUTUBE_API_KEY` |
| Admin | The owner's personal address, set in `ADMIN_EMAILS` in Vercel (not written in this public repository). The address must be confirmed, and it is checked in the database on every admin call. Everyone else gets a 404 |
| Vercel | Project `daily-intelligence`, region `sin1` (the Neon database is in ap-southeast-1) |
| Cadence | **All phases straight through.** Each phase is tested end to end and adds its own regression tests to the suite that gates every deploy (see "Regression suite"). Then: gate green, screenshots read, commit, push, deploy, production smoke tests pass. Then the next phase starts |
| Look | **Black-and-white newspaper.** This overrides the blueprint's navy/blue palette. Newsprint paper and ink-black type, with hairline and double rules, column grids, a datelined masthead, and a bold serif for headlines over a clean sans for UI chrome. **One spot colour, "press red"**, used only for Breaking/Live labels and the logo's signal dot. Charts use greyscale with patterns and direct labels, never colour alone. Dark mode is an **inverted-ink "night edition"**: near-black paper with warm off-white type, softened so it is not harsh pure white on pure black |
| Logo | Redrawn as a **single-ink SVG mark**: the D, the globe and orbit rings, and the three bars, with the red signal dot as its only colour. Paired with a **serif masthead wordmark**. Variants: horizontal, stacked, icon-only, favicon, PWA icons, light and dark |
| Landing and login | Flagship quality, built from the strongest references among the other products (see "Landing and login"). Each is reviewed with screenshots in both themes at 1440 and 390, plus a `ui-reviewer` pass, before the phase can close |

**Routine judgement calls** I'll make without asking:
- **Ports:** dev 4610, e2e 4620, screenshots 4630.
- **Fonts:** a high-contrast newspaper serif for headlines and the masthead (for example Playfair Display, or a display cut of Source Serif 4), Newsreader for reading text, and Geist or Inter for UI chrome.
- **Locale:** `en-IN` only for now, with next-intl wired so Tamil and Hindi can be added later.
- **Feed updates:** controlled polling (`/api/feed/pulse` every 60s, showing a "N new stories" banner) rather than SSE, because SSE keeps Vercel functions open.

## Source catalogue, launch set (strict rights)

Recorded per source in the `sources` table and in `docs/SOURCE_RIGHTS.md`, with the terms URL, the date checked, and each permission flag.

| Source | Shown as | Notes |
|---|---|---|
| GDELT GKG 2.1, 15-minute files (no key, no API rate limit) | title (`PAGE_TITLE`), publisher domain, seen time, link | **Primary discovery and velocity.** Each tick reads `lastupdate.txt`, streams the about 2.7 MB zip, and keeps rows matching India or global locations and themes. Locations, themes, people and organisations from GKG feed geography, category and entity tagging deterministically. Article images are **not** shown |
| GDELT DOC 2.0 API (no key) | the same | **Targeted topic queries only.** Probed today: it returned 429, "one request every 5 seconds", even on the first call. So at most about 5 paced queries per tick, rotated across categories, and treated as optional: a 429 opens the circuit breaker instead of failing the tick |
| PIB RSS (English, national and regional) | title, excerpt, link, "Official statement" tag | Reproduction is permitted with acknowledgement. Never counted as independent corroboration. The feed URL redirects with a language and region parameter (probed: 302), so the adapter follows redirects and stores the final URL |
| arXiv RSS (cs.AI, cs.CL, cs.LG, cs.CV) | title, authors, abstract, link, "Preprint" tag | arXiv metadata is CC0 |
| Other official feeds, each checked at build time before enabling | link and headline | RBI, MEA, ECI, ISRO, NASA (public domain), WHO, UN News |
| Publisher RSS (The Hindu, Indian Express, BBC and others) | **not fetched** | Personal or non-commercial terms. Listed as `pending_review` with the reason, and shown in the public source directory as "Not included: terms" |
| Bluesky (phase 4) | author, post text, time, link or official embed | Curated official accounts via unauthenticated `getAuthorFeed` (probed: 200). `searchPosts` returned **403** without auth, so topic search needs the optional `BSKY_HANDLE`/`BSKY_APP_PASSWORD` (a free app password) and stays off until those are set |
| Mastodon (phase 4) | the same | An explicit list of instances and hashtags, public visibility only, 7-day retention |
| YouTube (phase 4) | official embed | A curated channel catalogue using cheap `playlistItems` calls, never `search.list` on a refresh |

**AI input follows rights too.** An explainer reads only what each source's `ai_summary_allowed` permits:
- headlines and metadata from GDELT
- full text from PIB and official sources
- abstracts from arXiv

Publisher article bodies are never fetched. The story page says "Based on N headlines from M publishers; article text not read" where that applies. This is the honest limit of a strict-rights, free-sources product.

## Architecture

`src/` modular monolith, following Candlora's shape (`/Users/akash/Documents/Candlora/CLAUDE.md`):

```
src/app/(marketing)  landing, /sources directory, /privacy, /terms, /ai-policy, /status
src/app/(auth)       login (OTP + Google), verify
src/app/(app)/       for-you, today, hot, india, global, c/[category], story/[id], social,
                     briefings, saved, search, onboarding, settings/[tab], admin/*
src/app/api/         auth, cron/{tick,daily}, feed/pulse, health, push, ai/ask
src/components/      branding (SVG mark), shell, ui, story, feed, charts, settings
src/config/          brand.ts, navigation.ts, categories.ts, regions.ts
src/lib/
  db/        client (driver by URL), scope (withUser/withPublic/withSystem), schema/
  sources/   registry, rights (mayFetch, showable)
  ingestion/ adapters/{gdelt,rss,bluesky,mastodon,youtube}, pipeline, run recorder
  normalization/  canonical URL, title, language, geo, category
  clustering/     dedupe + story association
  ranking/        heat, confidence, importance, relevance (pure, versioned)
  personalization/ ai/ notifications/ search/ jobs/ (Postgres queue) mail/ design/
```

**Ported, not reinvented** (adapted for the new product):

| Concern | Source |
|---|---|
| Tokens, theme script, appearance | `Candlora/src/styles/tokens.css`, `src/lib/design/*`, `src/lib/settings/*` |
| Shell, command palette, nav config | `Candlora/src/components/shell/*`, `src/config/navigation.ts` |
| Settings layout, Panel/SettingRow | `Candlora/src/app/(app)/app/settings/*`, `src/components/settings/panel.tsx`. Appearance controls from `Bookie/components/settings/settings-panel.tsx` |
| UI primitives | `Candlora/src/components/ui/*` (lookup records, no cva). Sheet and ConfirmDialog from Fitrix `components/ui/index.tsx` |
| DB client, scopes, roles, migrate | `Candlora/src/lib/db/*`, `scripts/db/*`, `sql/roles.sql`, `drizzle.config.ts` |
| Actions, routes, errors, rate limit, env | `Candlora/src/lib/{actions/_define.ts,api/route.ts,errors.ts,rate-limit,env.ts}` |
| Auth | `Candlora/src/lib/auth/*`, with the emailOTP flow from `BuilderHut/lib/auth/merchant.ts` |
| Mail outbox | `Candlora/src/lib/mail/*` |
| NVIDIA client | `Market Place/lib/ai/nvidia.ts` (hedging, cooldowns, `chatJson`), with Candlora's `ChatModel` test seam |
| Cron | `Candlora/src/app/api/cron/daily/route.ts` (constant-time bearer check, budgets, `recordedJob`). Fan-out tick from Fitrix `apps/api/src/jobs/registry.ts` |
| Gate and screenshots | `Candlora/scripts/check-*.mjs`, `shoot.mjs`, `playwright.config.ts`, vitest configs |

**Daily Intelligence-specific guards** added to `check:guards` and `check:provenance`:
- Every story or item query goes through `showable()`.
- No `Math.random()` under `src/`.
- Demo fixtures are imported only by the demo provider, which always renders a `Sample` badge.
- No `NEXT_PUBLIC_` secret.
- The product name appears only in `brand.ts`.

## Phases

### Phase 0: repository, brand and skeleton
- **Repository**
  - `git init` inside the project, add the remote, copy the blueprint into `docs/`.
  - Write `docs/plan.md`, `IMPLEMENTATION_STATUS.md`, `CLAUDE.md` and `AGENTS.md`.
  - Scaffold the app and add `.gitignore` (covering `.env*` except `.env.example`).
- **Brand**
  - Single-ink SVG mark (the D, the globe and orbit rings, the three bars) with a press-red signal dot, plus a serif masthead wordmark.
  - Variants: horizontal, stacked, icon-only, favicon, PWA icons (versioned public paths, because of the Next file-icon cache trap).
  - Manifest and an OG image laid out as a newspaper front page.
- **Tokens**
  - Newspaper semantic tokens: `paper`, `paper-raised`, `ink`, `ink-muted`, `ink-faint`, `rule`, `rule-strong`, `press-red`, `press-red-ink`, `focus`.
  - Themes: light (newsprint), dark (night edition), system, and Candlora's `contrast`, with the dark block written three times and checked for drift.
  - Contrast is checked for every pair. press-red gets separate text and solid tokens, so it reaches 4.5:1 as text.
  - Text size, density and motion attributes come from a pre-paint script.
- **Newspaper primitives**: Masthead (date, edition, "Updated HH:MM IST" from real data), Rule (hairline, double, thick), Kicker, Dek, Byline/Source line, Column grid, Drop-cap (story page), and Breaking bar (inverted ink plus a press-red label).
- **Shell**
  - Desktop: slim sidebar and a top bar with the ⌘K palette, India/Global scope, notifications bell, theme toggle and profile.
  - Phone: a 5-item bottom bar (For You, Hot, Explore, Saved, Profile) and a navigation sheet for the rest.
  - Every route stub is intentional and labelled.
- **Database and health**
  - Database: client, roles SQL, migrate scripts, local databases created.
  - `/api/health` reports the role, RLS status and commit.
- **Gate, CI and deploy**
  - Gate scripts plus `pnpm verify`. The CI workflow runs the identical command.
  - Before going public: scan the whole history for secrets, then `gh repo edit --visibility public`.
  - Vercel project `daily-intelligence` (sin1) with env vars set, Neon migrated through `db:migrate:production`, deployed, `/api/health` read back.

### Phase 1: data-driven MVP
- **Auth and onboarding**
  - Better Auth: email OTP, Google, session list, sign out everywhere, account deletion.
  - Six-step onboarding as in blueprint §4, with a progress bar, back and skip. Step 6 previews the real feed with "Why this is here".
- **Schema** (blueprint §10, all tables)
  - users, user_preferences, user_interests, notification_preferences and subscriptions
  - sources (with every rights and health field from §6.3), provider_connections, raw_source_items, stories, story_items, story_updates, story_scores
  - user_story_feedback, bookmarks, collections, collection_items, notification_events, content_reports, audit_events, ingestion_runs, jobs, ai_briefings
  - Indexes, an FTS `tsvector`, `pg_trgm`. Every table is classified (owner-scoped FORCE RLS / shared reference / system-only / auth), enforced by a conformance test.
- **Ingestion**
  - The adapter interface, then the GDELT, RSS/Atom (PIB, arXiv, cleared official) and YouTube (dormant) adapters.
  - zod validation of each response, with quarantine for malformed items.
  - Normalisation: canonical URL (strip tracking params, AMP, `www`, fragments), title cleanup, language, event geography kept separate from publisher country, and a category rules map.
  - Rights stripping before persistence. `ETag` and `If-Modified-Since` on requests. Idempotent upsert on `(source_id, provider_item_id)` and `canonical_url_hash`.
- **Clustering v1** (deterministic): within a 72h window, normalised-title trigram similarity plus shared key terms and entities. Items can be re-associated later. Each story records `first_seen` and `story_last_updated_at`.
- **Scheduling**
  - `/api/cron/tick`: due sources (`next_poll_at`), leased with `FOR UPDATE SKIP LOCKED`, a 50s budget, and an `ingestion_runs` row per run.
  - `.github/workflows/tick.yml` fires every 15 min and on manual dispatch.
- **Screens**
  - For You, Today, Hot Now (heat v0: velocity + source spread + recency), India (state chips), Global (region chips), category pages, story page, Search (FTS with tabs and filters), Saved and collections.
  - The story page has timestamps ("Published 18 min ago · Detected 2 min ago"), a source panel with distinct-source count, Open original, save, share, text size, feedback and report.
  - Settings centre with route-per-tab: Account, Interests & follows, Sources & mutes, Region & language, Appearance, Reading, Notifications, Data & privacy, About & legal.
  - Admin shell with source health and an ingestion-runs table.
  - Every screen has designed loading, empty and error states.
- **Demo mode**: when no item has been ingested yet, or `DEMO_MODE=1`, sample fixtures are rendered behind a persistent "Sample content: not live news" banner and a `Sample` badge on every card.

### Phase 2: AI intelligence and ranking
- **NVIDIA adapter**
  - Server-only, hedged across models with cooldowns.
  - Prompts are versioned (`prompts/*.ts` plus a version string). Source text is wrapped as untrusted data, for prompt-injection defence.
  - Outputs are validated with zod against the source bundle: every claim cites a source ID that exists in the bundle, and unsupported numbers, dates or names are rejected.
  - Fallback is a non-generative summary built from metadata.
- **Enrichment jobs** (Postgres job queue): entity, topic and category extraction; cluster explainers (In one minute / What happened / Why it matters / Key details / What's next / Sources). Each records model, prompt version, source IDs and status in `ai_briefings`, with an "AI-generated summary" label and a "Limited source coverage" flag.
- **Scores** (pure functions, `ranking_version` stored with components)
  - Heat: blueprint §7 weights, against a per-story baseline.
  - Confidence: independent publishers, official vs reporting, consistency.
  - Importance: official alerts and category severity, never engagement.
  - Relevance: explicit interests outrank inferred ones, plus a discovery slot.
  - Diversity and run-limiting in the feed.
  - "Why trending" and "Why in your feed" are built from the stored components.
  - A test proves high heat with low confidence never reads as verified.
- **Briefings**: morning, evening, topic and "since I last checked", each citing source items and stating the period covered and coverage caveats.
- **Ask about this story**: answers are limited to the story's source bundle and the endpoint is rate-limited.
- **Eval set**: `vitest.eval.mts` over fixed sample records (breaking, disputed, low-source, syndicated, multilingual, politically sensitive). It runs against the live model and is not part of the gate.

### Phase 3: freshness, live updates and notifications
- **Ingestion resilience**
  - Per-domain pacing, exponential backoff with jitter, a circuit breaker on `sources`, and a kill switch per provider and globally.
  - Stale flags from observed freshness, a dead-letter list in admin, and dry-run ingestion.
- **Live feed**: `/api/feed/pulse` polling (paused while the tab is hidden), a new-stories banner, and scroll preserved without duplicates.
- **Web push**
  - VAPID keys generated and kept server-only, a service worker, and a permission prompt only after an explicit click.
  - Revoke, and pruning of invalid subscriptions.
- **Policy engine** (pure, fully unit-tested): quiet hours in the user's timezone, daily cap (default 3), per-cluster cooldown, idempotent dedupe key, both relevance and quality thresholds, and never virality alone. Notification copy follows blueprint §12.
- **Delivery**: email digests through the outbox. `notification_events` moves created → queued → sent → opened, never claiming "delivered". Admin gets test-send and a global pause.

### Phase 4: Social Pulse and dashboards
- **Social Pulse**
  - Bluesky, Mastodon and YouTube adapters, each behind its own kill switch.
  - Every card is labelled with platform and type (post / official / video / commentary), with the original link and official embeds.
  - "Accelerating" appears only against an observed baseline.
- **Dashboards** (Recharts, colours from tokens, accessible tables as an alternative): global pulse, topic heatmap, India vs Global, emerging topics, your interests, source diversity, reading. Each has a date range and an empty state.
- **Admin**
  - Provider quotas, latency and error rates, AI success rate and cost.
  - Cluster merge and split with an audit trail, report moderation queue, cadence and rights editor.
- **Story page additions**: coverage comparison (only where sources materially differ) and a timeline from `story_updates`.
- **Semantic search** with pgvector and NVIDIA embeddings, if pgvector is available both locally and on Neon. Otherwise it is recorded as deferred.

### Phase 5: visual explainers and hardening
- **Visual explainers**: on demand, built from motion components (animated timeline, map pins, key-figure cards) using verified facts only. Every one is labelled, has a transcript and links its sources. No synthetic footage.
- **Cost controls**: an AI spend budget table with a daily cap, plus job cancellation.
- **Editorial review**: a queue for high-impact or low-confidence briefings.
- **Hardening**
  - Retention purge job per source policy.
  - CSP and security headers, rate-limit and abuse tests, a load test of the feed and tick.
  - A `security-hardener` agent review.
- **Docs**: a native-mobile decision note (`docs/MOBILE_DECISION.md`) and final docs (README, ARCHITECTURE, SOURCE_RIGHTS, RUNBOOKS, KNOWN_LIMITATIONS).

## Regression suite: tests run on every deploy

Each phase ends with its journeys tested end to end. The tests it adds join a permanent suite, so later phases cannot break earlier ones.

- **Where the tests live**
  - `tests/unit`: pure logic, such as canonical URLs, clustering, scores, notification policy, AI schema and citation validation, and time labels.
  - `tests/integration`: against the real local `_test` database. Covers migrations from clean, RLS isolation (another user's row returns 404 or empty), ingestion replay idempotency using recorded GDELT and RSS fixtures, rights stripping, and AI fallback with a scripted `ChatModel`.
  - `e2e/`: Playwright desktop, Pixel 7 and reduced-motion projects, with axe. One spec file per phase journey: `p0-shell`, `p1-onboarding-feed`, `p1-story-sources`, `p1-saved-settings`, `p2-ai-explainer`, `p3-notifications`, `p4-social-dashboards`, `p5-explainer-admin`. External providers are served from recorded fixtures through a local mock server, so the e2e run never touches the network.
- **CI** (`.github/workflows/ci.yml`): every push and PR runs the full `pnpm verify`, using a Postgres service container.
- **Deploys go through CI only.** `deploy.yml` runs on push to `main` only after CI is green. It deploys with the Vercel CLI, then runs **production smoke tests** (`e2e/smoke/*.spec.ts`, read-only):
  - `/api/health` reports the pushed commit, `di_app` and RLS enforced.
  - The landing, login and source-directory pages render without console errors.
  - The public feed returns real items, each with a source link and timestamps.
  - Admin routes return 404 when signed out.
  - `/api/cron/tick` returns 401 without the secret.
  - A failed smoke test fails the workflow, and I report it rather than calling the phase done.
- **No skips** and no `.only` (`forbidOnly` is on). A test is never deleted or weakened to get a deploy through.

## Landing and login

The landing page tells the story as a **newspaper front page**:
- **Masthead**: dateline and a live "Updated" time.
- **Lead story**: the product promise as the headline, with a dek and the Sign up / Read today's edition CTAs.
- **Live front page preview**: real top stories from the public feed with their sources, or Sample-badged content in demo mode.
- **"How we read the news" columns**: sources, then clustering, then heat vs confidence, then AI explainers with citations.
- **"Hot ≠ true" explainer**: the two score dials shown side by side.
- **Source directory teaser**: what is in, what is out, and why.
- **Personalisation walkthrough**, then **FAQ**, a **closing CTA band**, and a **colophon-style footer**.
- Scroll reveals use the motion system and fall back to visible content, with reduced motion honoured.

Login is a split-screen broadsheet:
- **Left:** the masthead, today's real headlines, and the promise.
- **Right:** a focused card with email, then a 6-digit OTP input (paste-aware, auto-advance), plus Google.
- **States:** rate limiting, wrong code, expired code, network error and resend timer.
- **Phone:** a single column with the masthead strip.

**References** (from surveying all nine products):

| Use | Take from |
|---|---|
| Landing motion kit | **BuilderHut** `components/marketing/*`: `motion/react`, Reveal, Stagger, CountUp, Marquee, MotionToggle, fluid `clamp()` display type, and the pinned scroll scene with a stacked fallback for phones, reduced motion and Firefox. The "How we read the news" section becomes a pinned scene: one headline flows from source, to cluster, to scores, to explainer |
| Live product mock, not screenshots | BuilderHut `HeroStage` / Candlora `WorkspacePreview`. The hero front page is rendered from the real story-card components |
| Reveal safety | **Bookie** `components/marketing/reveal.tsx`: content is visible without JS, and both the OS setting and the in-app `data-motion` are honoured |
| Section order, FAQ, CTA band | Candlora `components/marketing/*` and Studio Pulse (every CTA routes into sign-up with context) |
| Login layout and OAuth | **CodeAtlas** `components/auth/{AuthLayout,OAuthButtons,authError}`: split layout with the brand panel removed from the DOM below 900px, only configured providers shown, central error mapping |
| OTP field and messages | Bookie `components/auth/code-input.tsx` (6 boxes acting as one field, paste and arrow keys) and Candlora `lib/auth/messages.ts` (wording for 429, lockout and wrong code) |
| Visual comparison | Bookie `shots/home-*.png` as the quality bar to beat |

Everything is restyled in the newspaper system. No three.js; the hero weight budget is enforced by `check:budget`.

## Verification (every phase)
- `pnpm verify`: secrets → tokens → layout → contrast → guards → provenance → typecheck → lint → unit → components → integration (local `_test` database) → build → e2e (desktop 1440, Pixel 7, reduced motion, axe) → budget → no-todo.
- `node scripts/shoot.mjs` captures every changed route in light and dark at 1440 and 390, and **I read every screenshot**, using the `ui-reviewer` agent as a second opinion on major screens.
- Side effects are confirmed by reading them back:
  - Run a tick locally, then count rows in `ingestion_runs`, `raw_source_items` and `stories` (it must be non-zero and must not grow on a replay).
  - After deploy, `/api/health` must report `di_app`, `rowSecurityEnforced: true` and the pushed commit.
  - Trigger the GitHub tick workflow manually, then read production run rows.
- E2E journeys follow blueprint §19:
  - sign in (dev outbox OTP), then onboarding, then a personalised feed
  - filters
  - story source links
  - save and collections
  - mute
  - settings that persist
  - push opt-in only after permission, and quiet hours suppressing
  - admin returns 404 to non-admins
- Each phase ends with a commit, a push and a deploy. `IMPLEMENTATION_STATUS.md` is updated with what was built, what was verified (only checks that actually ran), and what is outstanding.

## Things you'll need to do (I'll list them again at each phase end)
1. Add these redirect URIs to CodeAtlas's Google OAuth client:
   - `http://localhost:4610/api/auth/callback/google`
   - `https://daily-intelligence.vercel.app/api/auth/callback/google` (or the URL actually assigned)
2. Optional: create a YouTube Data API key, and a Daily Intelligence GitHub OAuth app.
3. **Rotate the Neon `neondb_owner` password after setup.** It was pasted in chat. It will never be committed, but it is in this transcript.
4. Sign in once on production with the address in `ADMIN_EMAILS` to confirm it, which activates admin.

## Known risks
- GitHub Actions cron can run 5–20 minutes late under load. Freshness labels show real times, and the daily Vercel cron is the backstop.
- Strict rights make Indian publisher coverage headline-and-link only, via GDELT. That is honest and thinner than an aggregator.
- On Vercel Hobby, ticks are kept under a 50s budget. Any work left over continues on the next tick, picked up from the lease and cursor.
