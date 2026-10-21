# Daily Intelligence — working notes

A personalised news intelligence desk for India and the world: rights-checked
free sources, stories clustered across publishers, heat kept apart from
confidence, and AI explainers that cite every claim. Next.js 16 (App Router) on
Vercel, Postgres (Neon in production, local Postgres for dev and test),
Tailwind v4. The scope is `docs/BLUEPRINT.md`; the approved plan and the
decisions already made are `docs/plan.md`; what is built and verified is
`IMPLEMENTATION_STATUS.md`. It is built one phase at a time, and each phase
passes the gate and is deployed before the next starts.

@AGENTS.md

## Shape

```
src/
  app/            (marketing) landing + trust pages, (auth) sign-in, (app) the paper,
                  api/ (auth, cron, health), dev/ (design reference, off in production)
  components/
    branding/     the mark and the masthead wordmark (geometry in lib/brand)
    marketing/    landing sections, site header and footer, reveal
    news/         masthead, story anatomy (and, from phase 1, story cards)
    shell/        the signed-in frame, edition switch, command palette, section pages
    settings/     Panel/SettingRow, step-up
    ui/           primitives: cn, button, badge, card, dialog, segmented, states
  config/         brand.ts (the only place the product name is written), navigation.ts,
                  categories.ts, regions.ts, sections.ts (in-preparation copy)
  lib/
    auth/         Better Auth (authFor), passwordless email codes + Google/GitHub,
                  session, step-up by emailed code, security log
    brand/        mark geometry: one drawing for the inline mark, the SVGs and the icons
    db/           client (driver by URL), scope (withUser / withPublic / withSystem),
                  schema/ (identity, news, reader, ops, settings), classification.ts, sql.ts
    sources/      catalogue.ts: every source considered, and the rights decision for each
    queries/      reader-facing reads (server-only)
    services/     the layer that may act across users (health, jobs, admin)
    design/       theme vocabulary, pre-paint script, theme store
    settings/     preferences whitelist, client store, appearance script
    rate-limit/   Postgres fixed-window limiter
    env.ts        zod-parsed server environment
  styles/tokens.css   the only place colour is defined
drizzle/migrations/   generated DDL plus hand-written access rules
sql/roles.sql         the runtime roles (di_app, di_auth)
scripts/              the gate (check-*.mjs), shoot.mjs, db/, brand/render.mts
tests/                unit, components, integration (local _test database only)
e2e/                  Playwright: tests/ (desktop, Pixel 7, reduced motion, axe), smoke/ (production, read-only)
```

## Conventions that are load-bearing

- **No fabricated news.** Every story on screen comes from a source in the
  catalogue that is `cleared`, with its link, its publication time and its
  detection time -- or it is in the demo edition (`DEMO_MODE=1`), badged
  Sample under a banner. `check:provenance` bans `Math.random()` under `src/`,
  keeps sample data in `src/lib/demo/`, and lets only `src/lib/demo/provider.ts`
  read it. A page with nothing to show says so; it never fills the space.
- **A feed existing is not permission.** A source is fetched only when its
  terms were read and permit what we do (`src/lib/sources/catalogue.ts`, with
  the quote and the date). Unclear is `pending_review` and never fetched. The
  database refuses `enabled` without `rights_status = 'cleared'`.
- **GDELT licenses its data, not the publishers' headlines inside it.** From
  GDELT we show a headline, a domain, a time and a link -- no excerpt, no image,
  no AI over article text -- and drop every domain in
  `EXCLUDED_PUBLISHER_DOMAINS` before storing anything (`publisherAllowed()`).
- **What may be shown is decided in one place.** `showableSource()`
  (`src/lib/db/sql.ts`) on a query that joined `sources src`. Every query module
  that reads items or stories calls it; `check:guards` fails one that does not.
- **Six times, never substituted** (blueprint §6.4): published, source-updated,
  ingested, last-checked, story-last-updated, AI-generated. A missing
  publication time is shown as "not given", never filled with the detection time.
  `timesLine()` in `lib/format/date.ts` is the one way it is written.
- **A model sentence is shown only after it passes `checkClaims`**
  (`src/lib/ai/validate.ts`): it cites a record it was given, every number is in
  a record it cites, every name is in the bundle, an official claim is
  attributed. One correction attempt, then `rejected` -- stored, never shown
  (row security hides it from the runtime role, not only the WHERE clause).
  Every model output is labelled "AI-generated", wherever it appears.
- **The model reads only what the page may show.** `loadBundle()` applies
  `showableSource()`, and an excerpt goes in only where the source allows both
  showing it and AI summaries of it. From GDELT: headline and times only.
- **Never call the model inside a transaction.** Read, close, call, open again
  to write: a 20-second call would hold Neon's one pooled connection.
  Every call has a deadline (`nvidiaModel({ deadline })`); running out of time
  is `AiOutOfTime`, recorded as nothing, not as a failure.
- **Prompts are versioned.** Change a prompt's words, change its
  `*_PROMPT_VERSION`; every stored output names the version that wrote it.
  `pnpm eval:ai` runs the live model on fixed bundles after any prompt change.
- **Heat alone never notifies.** `decide()` (`src/lib/notifications/policy.ts`)
  needs confidence and, except for breaking news, a follow. Every decision is
  one `notification_events` row per reader and dedupe key; "sent" means handed
  over, never "delivered".
- **A missing `ops_switches` row is ON.** Switches stop things; a forgotten row
  must never be what stops the paper.
- **A social post is never our text.** `social_posts` has no text column: a
  post is shown only through its platform's own embed (`showableSocial()`),
  matched to a story by its words, and feeds heat, never confidence. A platform
  is connected only after its terms are read and quoted in the catalogue.
- **Every story has a picture, and none has one it has no right to.**
  `storyImage()` (`src/lib/media/story-image.ts`) is the one choice: a licensed
  photo, then an AI illustration, then a map, then the section's cover art.
  Publisher photos are never a choice (GDELT carries their URLs; they are the
  publishers'). A source's picture is kept only through `acceptMedia()` (its
  own `mediaHosts`, no logo, no one else's credit) and shown only through
  `showableMedia()`; `next.config` image hosts are held to the catalogue by a
  test. A map needs a reliable place: an Indian state (a pin, never an
  outline) or exactly one country abroad.
- **An AI illustration is drawn only from the headline and section, with
  every capitalised word removed, never for a sensitive section or a
  headline about violence, conflict, crime, death or disaster**
  (`illustrationPrompt()`), and shown only after a vision check answers no to
  every question (`verdictFrom()`; a missing answer is a yes). Refused
  pictures are never uploaded; their rows are hidden by row security. It is
  labelled "AI illustration" on the picture itself, everywhere. NVIDIA's own
  filter refuses some style wordings (`CONTENT_FILTERED`); the measured
  wording is recorded beside the prompt -- change it, re-measure it.
- **Heat is not confidence.** Two scores, stored with their components and a
  version, shown side by side. Nothing may combine them into one number.
- **Themes are palettes, and the alert colour is reserved in every one.**
  `data-palette` (Aurora, the default; Newspaper; Terminal; Blueprint; Studio), `data-theme` (light or
  dark, always concrete) and `data-contrast="more"` are three independent
  attributes. Accents, gradients and status hues are free; the `press` tokens
  mean breaking, live or wrong and nothing else, and `check:contrast` holds them
  visibly apart from the accent. Colour only through tokens: no hex, `rgb()`,
  named colours or Tailwind palette classes under `src/` (`check:tokens`). The
  two exceptions, each named in its ALLOW list with the reason, are the mail
  template and the OG image.
- **Colour values live only in `src/styles/themes/*.ts`.** `pnpm themes`
  generates `src/styles/themes.generated.css` (committed); `check:themes` fails
  if it is stale or hand-edited. Every palette fills every colour and style
  token for both modes. `check:contrast` measures the sources in every palette
  × mode × contrast -- including text over the atmosphere's light and on glass,
  composited at the palette's own opacities -- and fails on a colour literal in
  `tokens.css` or `palettes.css`. A palette's look belongs in its tokens (so a
  `[data-preview-palette]` card draws it); `palettes.css` keeps only what must
  be keyed on the page's palette.
- **A preference saved before palettes is read, never written.** A stored
  `theme` (or `localStorage["app-theme"]`) of light/dark/contrast means
  Newspaper in that mode; the next save writes `palette`/`mode`/`contrast` and
  drops it. The day/night key is `mode`, never `theme`, so the two cannot be
  confused.
- **Motion: Full, Calm, Reduced.** The OS reduced-motion setting always wins.
  Anything that loops carries `.ambient` (Calm stops it); entrance states live
  inside `(prefers-reduced-motion: no-preference)`; a change of look goes through
  `withLookTransition()`, which never makes the change conditional on the
  animation.
- **The product name lives in `src/config/brand.ts`.** `check:guards` fails if
  it is typed anywhere else under `src/`.
- **Class names are written out in full.** Tailwind scans source text; a class
  built from a variable is never generated.
- **A date that means a day is a string.** Instants are ISO strings formatted
  by Postgres (`isoInstant`), never a driver's Date.
- **Every database access goes through a scope.** `withUser`, `withPublic` or
  `withSystem` in `src/lib/db/scope.ts`. The runtime role is NOBYPASSRLS and
  every table has FORCE RLS, so a query outside a scope returns zero rows, not
  an error. An empty screen is a missing scope far more often than missing data.
- **Never nest scopes.** Neon's pool is one connection; an inner transaction
  waits forever for the one the outer holds. It passes locally and hangs
  deployed. The guard throws `ScopeError`; pass the open `tx` down.
- **`withSystem` only in services, ingestion, auth, mail, jobs and rate-limit.**
  `check:guards` fails on a call anywhere else.
- **Every table is classified** in `src/lib/db/classification.ts` (owner /
  reference / system / auth); the isolation conformance test fails on an
  unclassified table.
- **An administrator is a confirmed address in `ADMIN_EMAILS`, checked in the
  database by every admin function** (`lib/services/admin.ts`). Everyone else
  gets 404, never 403.
- **Passwordless.** An emailed six-digit code signs in and, the first time,
  creates the account. Step-up (export, delete, sign out everywhere) is a fresh
  emailed code. No password column is ever used.
- **Sign-in starts are origin-checked by us**, not only by the library: its
  cookie-based check does not see a request with no session yet, and its
  login-forgery check does not cover the email-code plugin. See the `before`
  hook in `lib/auth/auth.ts` and the test "refuses a sign-in posted by a form on
  another site".
- **Every exported server action is built by a wrapper** from
  `src/lib/actions/_define.ts`. An action is its own entrypoint: no layout
  guard runs before it.
- **Errors leave as a reference, never as themselves** (`toFailure`).
- **Mail is queued inside the transaction that caused it** (`queueMail(tx, …)`)
  and delivered after commit. Never log a body or a full address.
- **The session comes from the database on every request.** A layout guard is
  not a boundary.
- **Secrets are server-only.** Never a `NEXT_PUBLIC_` prefix.
- **Migrations are additive**, generated with `pnpm db:generate`. Access rules
  go in a separate hand-written migration. Cast a session setting to uuid only
  through `NULLIF(current_setting(…, true), '')`.
- **A settings tab is listed only when what it holds works.** A section of the
  paper not yet built shows the labelled in-preparation page from
  `config/sections.ts`; `tests/unit/navigation.test.ts` fails if a built route
  keeps its entry.

## The gate

`pnpm verify`. A phase is not done until it passes. No skips, no `.only`
(`forbidOnly` is on), no weakened checks. `pnpm check` is the fast inner loop.

Order: secrets → tokens → layout → contrast → guards → provenance → typecheck →
lint → unit → components → integration → build → e2e → budget → no-todo. CI
(`.github/workflows/ci.yml`) runs the identical command.

Every phase adds its own tests to the permanent suite (`e2e/tests/p<N>-*.spec.ts`
and the matching unit and integration files), so a later phase cannot break an
earlier one without the gate saying so.

Then look at the screen: `pnpm build && node scripts/shoot.mjs / /login` writes
`shots/` in day and night at 1440px and 390px; `SHOOT_SIGNED_IN=1` signs in
through the dev outbox first. Read them.

Ports: dev 4610, e2e 4620, screenshots 4630.

After a deploy: `SMOKE_BASE_URL=<url> SMOKE_EXPECTED_COMMIT=<sha> pnpm test:smoke`
(read-only), and `/api/health` must report `di_app`, `rowSecurityEnforced: true`
and the commit that was pushed.

## Things that have already bitten

- **The parent directory is a different git repository.** `~/Documents` has its
  own `.git` whose remote is an unrelated project. Run git only inside this
  directory. `check:secrets` asserts the git root is this directory.
- **The repository is public.** `check:secrets` runs first in the gate and
  scans everything git would commit; production values live only in
  `.env.neon.local` and Vercel, never in a tracked file.
- **PIB refuses some user agents.** A descriptive UA containing "Bot" or a URL
  got 403; `DailyIntelligence/0.1 (news reader; contact via …)` is accepted.
  Never disguise the client as a browser to get past a block. The English feed
  needs `&reg=3`, or the site redirects to Hindi.
- **GDELT's DOC API rate-limits hard** (429 on the first call: "one request
  every 5 seconds"). The 15-minute GKG files are the primary source; the DOC API
  is optional and circuit-broken.
- **arXiv publishes nothing at weekends.** An empty feed on a Sunday is normal,
  not a failure.
- **Next's route announcer is a `role="alert"`.** A test that asks for "the
  alert" finds two; filter by text.
- **A visually hidden radio cannot be `check()`ed by Playwright** -- click its
  label, as a person does (`choose()` in `e2e/tests/p0-settings.spec.ts`).
- **A direct `auth.api.*` call without `headers`** fails with "Dynamic baseURL
  could not be resolved". Pass the request's headers.
- **"Edition" means India / World / Both.** The day/night setting is "Colour
  scheme"; two controls with one name confused the tests and would confuse a
  screen reader.
