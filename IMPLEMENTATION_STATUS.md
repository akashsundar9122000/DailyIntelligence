# Implementation status

What is built, what was verified (only checks that were actually run), and
what is outstanding. Updated at the end of every phase.

The plan is `docs/plan.md`; the scope is `docs/BLUEPRINT.md`.

| Phase | Scope | State |
|---|---|---|
| 0 | Repository, newspaper identity, shell, sign-in, database security, the gate, first deploy | Done, deployed |
| 1 | Sources, ingestion, clustering, scores, the editions, story page, search, saved, onboarding, settings, admin | Done, deployed, verified in production |
| 2 | AI explainers with citations, AI category tagging, briefings, ask about a story, eval set | Done, deployed, verified in production |
| 3 | Live updates, web push, notification policy, digests, resilience | Done, deployed, verified in production |
| 4 | Social Pulse, dashboards, admin cluster tools and moderation, semantic search | Done, deployed, verified in production |
| 5 | Visual explainers, AI cost caps, editorial review, retention purge, hardening, final docs | Done, deployed, verified in production |
| 6 | Themes (Aurora default, Newspaper, Terminal, Blueprint, Studio), motion settings, the landing page in motion, page transitions | Done, deployed, verified in production |

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

Verified in production (commit `bfd5048`): the smoke suite passed 24 of 24; a
manually triggered tick stored 139 GDELT items, 20 PIB, 10 NASA and 20 Federal
Reserve items, and saved GDELT's cursor.

Fixed after deploying: GDELT's first run in production answered "not modified"
and stored nothing, because the index names a file before it exists. The start
is now clamped to the newest possible file, only a real archive counts, and a
first run that finds nothing fails with what it tried (regression tests in
`tests/integration/ingestion.test.ts`).

Known limitations:

- A preference changed in the moment before leaving the page can be lost:
  preferences are saved a moment after the change, not on unload.
- GDELT tags a story with every country it mentions, so a few world stories
  appear in the India edition. Phase 2's category tagging is where this is
  tightened.
- arXiv publishes nothing at weekends; an empty arXiv run on a Sunday is normal.

## Phase 2

Built:

- **Explainers** (`src/lib/ai/explainer.ts`): written by the AI pass
  (`/api/cron/enrich`, the tick workflow's second step) for every story with a
  second publisher or an official source. In one minute / what happened / why
  it matters / key details / what is next, each only where a record says it.
- **Checks** (`src/lib/ai/validate.ts`): every sentence cites a record it was
  given; every number is in a record it cites; every name is in the bundle;
  official claims are attributed; no certain futures. One correction attempt,
  then `rejected`: stored for review, hidden from readers by row security.
- **Rights**: the model reads what the page may show, and an excerpt only where
  the source allows AI summaries. GDELT stories are explained from headlines,
  and the page says "article text was not read".
- **Sections by AI** only when the rules found none, from the fixed list, and
  the story page says so.
- **Briefings page**: the morning and evening edition briefing (06:00 and 18:00
  IST, once three stories are explained), a catch-up since the last visit, and
  round-ups of followed sections. Model sentences are labelled wherever shown.
- **Ask about this story**: answered from the story's records only, rate
  limited per account, the question not stored; "the sources here do not say"
  when they do not.
- **Cost and time**: a daily ceiling on model outputs (`AI_DAILY_LIMIT`,
  default 300), every call bounded by the run's deadline, reasoning turned
  down per model family.
- **Eval set** (`pnpm eval:ai`, not in the gate): seven bundles, one per way an
  explainer goes wrong, plus two questions, against the live model.

Verified locally:

- `pnpm verify` passed: 191 unit, 36 component, 121 integration and 258
  end-to-end tests, including the AI journeys against a stand-in model and axe
  on the explainer and briefings pages in both themes.
- The live eval passed 9 of 9: every explainer either passed every check or
  was rejected, an instruction planted in a record was not obeyed, a
  disagreement was cited on both sides, an unanswerable question was declined.
- The AI pass against the development database with the real model: 8
  explainers, 0 rejected, the morning briefing written, in 18 seconds.
- Screenshots of the story page and the briefings page read in both themes at
  1440px and 390px. Two fixes came from looking: repeated sentences are dropped,
  and a model line that only restates its headline is not printed twice.

Verified in production (commit `4a49666`): the smoke suite passed 24 of 24; the
tick workflow's AI pass wrote 7 explainers and the morning briefing with
Nemotron, none failed. One explainer was rejected only because the model
suggested a section not on the list; that now drops the section instead
(`1c95e10`).

Known limitations:

- From headlines alone the explainers are short. That is the honest limit of
  showing and summarising only what the sources' terms allow.
- Clustering sometimes leaves two reports of one event as two stories (seen:
  two Trump-Netanyahu headlines), so the briefing can list both.
- The name check covers capitalised words only; a lower-case detail a model
  adds is caught only if it carries a number.

## Phase 3

Built:

- **Notification policy** (`src/lib/notifications/policy.ts`, pure): the
  editors' pause, the reader's pause and choices, quality thresholds per kind
  (heat alone never alerts: confidence and a follow are required), quiet
  hours in the reader's time zone, a daily cap, a twelve-hour cooldown per
  story.
- **The notification pass** (`/api/cron/notify`, the tick workflow's third
  step): at most one alert per reader per run; every decision recorded once
  per reader by a dedupe key, with the reason when the reader's own rules held
  it back; scheduled morning and evening briefings; the email digest through
  the outbox.
- **Web push**: VAPID keys (production values in Vercel only), a service worker
  that only shows and opens notifications, the permission prompt only after a
  button press, devices listed and removable, a device the push service calls
  gone is revoked. "Sent" means handed over; nothing claims "delivered".
- **Settings, Notifications tab**: this device, the alert rules, pause,
  devices, and recent notifications with what was held back and why.
- **Live updates**: `/api/feed/pulse` polled once a minute while a page is
  visible; a "N new stories" button that loads them only when pressed.
- **Resilience**: switches in the press room for ingestion, each provider, the
  AI pass and notifications (audited, with a reason); sources marked stale when
  they answer with nothing new for longer than their kind allows; a dry-run
  read that stores nothing; one request a second per host; a "needs attention"
  list of stale and failing sources and failed runs.

Verified locally:

- `pnpm verify` passed: 202 unit, 36 component, 133 integration and 280
  end-to-end tests.
- End to end, through the real web-push library: an alert for a followed,
  confirmed story reached a stand-in HTTPS push service (which refuses anything
  unsigned or unencrypted), was recorded once, and was marked opened when its
  link was followed; a device answering 410 was revoked.
- Screenshots of the Notifications tab read in both themes at 1440px and 390px.

Verified in production (commit `6dbbc1b`): the smoke suite passed 24 of 24;
the tick workflow ran all three steps (tick, AI pass, notification pass) and
the notification pass recorded its run with 0 readers opted in, which is the
truth on a new deployment.

Known limitations:

- Push cannot be exercised against a real browser push service in the suite;
  the stand-in checks that each send is signed and encrypted, not that a phone
  showed it.
- iPhones receive web push only from a site added to the home screen; the page
  says so.

## Phase 4

Built:

- **Social Pulse** (`/app/social`): mastodon.social, cleared on 19 October 2026
  after reading its terms -- public posts from local accounts that opted into
  discovery and indexing, no bots, reblogs or content warnings, shown only
  through mastodon.social's own embed and linked. The post's text is never
  stored: only its significant words (links removed) and hashtags, to match it
  to a story. Deleted posts are dropped at the next check; nothing is kept past
  seven days. Conversation around stories ("accelerating" only against the
  story's own baseline), topics by hashtag, and each story's own "Public
  conversation". Matched posts feed heat's engagement component (score version
  `rules-2026-10-19`), never confidence.
- **Bluesky** is built and tested but not switched on: its developer guidelines
  require a public, monitored contact email, which is the owner's decision.
  **YouTube** is not connected: its terms forbid automated access without the
  official API, and no API key exists.
- **Search by meaning**: headlines embedded with `nvidia/nemotron-3-embed-1b`
  (2048 dimensions, stored as pgvector `halfvec` with an HNSW index); Explore
  shows "Close in meaning" beside the word search, labelled. The cut-off (0.70
  cosine distance) was measured on real headlines.
- **Dashboards**: Today's "The day in numbers" (counts, India and the world,
  sections through the day as an accessible table), "Your sections" on For You,
  and the reader's own reading on Saved.
- **The newsroom** (press room): readers' reports resolved with a note,
  possible duplicate stories suggested by meaning and merged with readers'
  saves following, a report moved out of a story it was wrongly attached to,
  and the AI pass in counts. Every action audited.
- **Fixed on the way**: a refresh of a story wiped a section the model had
  chosen; social sources no longer count toward "sources reporting".

Verified locally:

- `pnpm verify` passed: 202 unit, 36 component, 144 integration and 302
  end-to-end tests.
- A live tick read 400 posts from mastodon.social, kept 65, left out 335 by the
  rules, and matched the right post to the right story.
- Real searches by meaning: "papal health" found the Pope's surgery stories,
  which share none of its words; "military deaths in Canada" found four
  headlines about the Alberta base fire.
- Screenshots of Social Pulse and Today read in both themes; the day's numbers
  were moved above the long list after looking, and the heatmap given a
  logarithmic shade after one section flattened the rest.

Verified in production (commit `9682108`): the smoke suite passed 24 of 24;
the workflow's tick read 57 posts from mastodon.social and matched one to a
story, and the AI pass embedded 128 headlines.

Known limitations:

- Clustering still splits some events (the Alberta fire was four stories); the
  duplicate suggestions in the press room are where a person merges them.
- On weekdays arXiv's preprints are most of the day's story count.
- A cadence editor was not built: the catalogue sets every source's cadence on
  each tick, so an edit made in the press room would silently revert. Cadence
  stays a reviewed change to `src/lib/sources/catalogue.ts`.

## Phase 5

Built:

- **Content security policy**: a fresh nonce per page with `'strict-dynamic'`
  (`src/proxy.ts`), frames only from mastodon.social and Bluesky's embed host,
  `upgrade-insecure-requests` only over https; plus
  `Cross-Origin-Resource-Policy`, `/.well-known/security.txt`, `SECURITY.md`
  and GitHub private vulnerability reporting switched on.
- **Retention purge** in the daily job: items past their source's retention
  (or ninety days after their story last moved), stories left with nothing,
  and aged bookkeeping. A story a reader saved, and its headline item, are
  never purged. Its own run in `job_runs`.
- **Editorial review** (`EDITORIAL_REVIEW=1`): explainers for high-impact or
  thinly sourced stories wait in the press room; held output is hidden from
  readers by row security; approval applies the section suggestion; rejection
  needs a reason; audited.
- **Visual explainer**: the checked explainer and its records as a sequence of
  cards -- summary, key figures with their citations, the reporting timeline,
  places, sources -- with no footage, no images and no new words; plays only
  when asked, starts still under reduced motion, full transcript underneath.
- **Cost and abuse limits**: reader-initiated model calls counted per account,
  per network address and for all readers in a day, failing closed; guesses at
  a code fail closed; at most ten push devices per account, only from the
  browsers' push services, delivered in parallel with a five-second timeout.
- **From the security review** (an independent read-only pass): the push
  allowlist and device cap; sign-in codes only over HTTP, closing a timing
  signal of which addresses have accounts; step-up codes are spent once used;
  the service worker resolves notification links by origin; `/api/health`
  holds its answer five seconds.
- **Docs**: `docs/ARCHITECTURE.md`, `docs/RUNBOOKS.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/MOBILE_DECISION.md`, README updated.

Verified locally:

- `pnpm verify` passed: 204 unit, 36 component, 154 integration and 312
  end-to-end tests.
- The policy end to end: every inline script carries the page's nonce, a new
  nonce per request, and a frame from a host not on the list is refused while
  nothing the paper needs is.
- Load: `node scripts/load.mjs` against a local production build, 20 clients
  for 20 seconds across five public pages: 515 requests a second, p50 39 ms,
  p95 71 ms, no errors. (A first run showed 500s on /login: the build refuses
  the development key, by design; the run was repeated with a throwaway one.)

Verified in production (commit `7ab2ff7`): the smoke suite passed 28 of 28,
including the nonce policy (with `upgrade-insecure-requests` over https) and
`security.txt`; the tick workflow and the daily job ran every step -- tick, AI
pass, notifications, daily, retention -- each recorded `OK` in `job_runs`.

Not done, and why:

- `__Host-` cookie prefix: better-auth sets `__Secure-`; changing the prefix
  would sign every reader out, for a small gain. Noted for a later release.

## After phase 5: YouTube and Google sign-in (2026-10-19)

- **YouTube connected** (`6040540`), after reading the YouTube API Services
  Developer Policies: seven official channels (NASA, WHO, the UN, PIB India,
  ISRO, DD News, Reuters), public and embeddable videos only, in YouTube's own
  unaltered player (privacy-enhanced mode), kept seven days, no statistics, and
  never counted or scored (the policies forbid derived metrics and
  aggregation). Verified in production: the tick read 39 videos and placed 4
  beside their stories.
- **Google sign-in fixed.** Production was sending the client id with literal
  quotation marks, copied from an env file when the variables were first set,
  and Google answered `invalid_client`. Both Google values were set again
  without them; Google now shows its sign-in page for this site's callback.

## Phase 6a: the theme engine, Aurora, Newspaper, Settings (2026-10-19)

Built:

- **Palettes, generated from one source.** Colour, type, corners, card treatment
  and motion for each palette live in `src/styles/themes/*.ts`;
  `scripts/build-themes.mts` writes `src/styles/themes.generated.css`
  (committed), and the new `check:themes` gate step fails if it is stale. The
  three hand-copied night blocks and their drift check are gone.
- **Aurora is the default**: violet and teal light drifting behind frosted
  cards and a glass frame, Bricolage Grotesque headlines, rounded corners and
  a springier step. **Newspaper** is unchanged in look, with its masthead rules
  now drawn across once on load.
- **High contrast is a switch** over any palette and mode (7:1 text, no glass or
  glow). **Motion is Full / Calm / Reduced**; Calm stops the drifting light and
  the ticker, and the OS setting always wins.
- **Settings > Appearance** chooses the theme from live preview cards (the real
  tokens, through `[data-preview-palette]`), plus colour scheme, high contrast
  and motion. Changes of look animate (a circle from the click, a crossfade
  from the keyboard, nothing under Reduced).
- **Existing readers keep their choice.** A stored `theme` of light, dark or
  contrast (account or `localStorage`) resolves to Newspaper in that mode and is
  rewritten in the new keys on the next save.

Verified:

- `check:contrast`: 418 pairs across 2 palettes × day/night × plain/high
  contrast, including text over the atmosphere and on glass composited at each
  palette's opacity, and the alert colour held apart from the accent (it was
  180 pairs over 5 scopes).
- e2e: 347 passed (4.8 min), including `p6-themes.spec.ts` on desktop and
  mobile (each theme chosen in Settings and kept after reload, high contrast,
  Calm, axe on `/app` and Settings in all 8 looks, the legacy visitor, the
  header switch keeping the palette), the public axe matrix (every look on `/`,
  `/login`, `/dev/tokens`; 72 runs, was 54) and the reduced-motion project.
- Budget: shared 167 KB (unchanged), all chunks 433 KB (was 426 KB).
- Screenshots read in both palettes, day and night, with and without contrast,
  at 1440 and 390, signed out and signed in.

Not green, and why:

- `tests/integration/ai.test.ts` › "says the sources do not say…" fails, and
  fails identically on a clean checkout of `6040540`, so it predates this phase.
  Cause: `recordLine()` puts the publication time into each record's text, and
  `checkClaims` counts its digits as support, so the invented "40 officials" is
  accepted whenever the seeded item was published at :40. It is a real gap in
  the validator, not only in the test. Not changed here: it is outside this
  phase's scope and needs a decision.

Not done yet (6b, 6c): Terminal, Blueprint and Studio; the landing page's
animated hero, theme strip, scroll story and page transitions.

## Phase 6b: Terminal, Blueprint and Studio (2026-10-19)

Built:

- **Terminal**: navy and amber (paper-grey and dark amber by day), Sofia Sans
  Condensed over JetBrains Mono, square panels with an amber top bar, a `>`
  prompt before kickers, page titles typed in once, one scan of light when a
  page opens, a caret after the live tag.
- **Blueprint**: blue ink on vellum by day, white linework on blueprint blue at
  night, Archivo Narrow and Archivo with Azeret Mono, a graph grid under the
  page that draws in once, dimension ticks on every panel's corners, rules
  inked left to right. Markup is green: red stays the alert colour.
- **Studio**: obsidian and indigo (studio-white by day), Manrope and Inter,
  glossy solid cards, one soft spotlight, AI marks that breathe a slow glow,
  and a sky over the Today page that follows the hour in India.
- All five themes have day, night and high contrast; only the chosen theme's
  fonts download.

Verified:

- `pnpm verify` green: check:contrast 1006 pairs across 20 scopes (three real
  conflicts found and fixed: Terminal's day amber too close to the alert red;
  Blueprint's filled alert tag on blue at night, now bright red with dark
  type); unit 213, components 40, integration 159; e2e 419 passed (6.0 min,
  axe in all 20 looks on the landing page, sign-in, the design reference, the
  paper and Settings); budget shared 167 KB, all chunks 438 KB.
- Screenshots read for every theme, day and night, landing page and the
  signed-in paper and Today page, at 1440 and 390. Fixed from them: the Today
  sky overlapped the dateline beneath it.

Still open:

- The AI claim-check gap recorded under 6a is unchanged. Its test passed in
  this run only because the seeded time did not end in :40.

## Claim check: clock times are one value (2026-10-19)

- `checkClaims` read a record's publication time ("11:40 am") digit by digit,
  so an invented "40 officials" was accepted whenever the cited record was
  published at :40 -- and `tests/integration/ai.test.ts` passed or failed by
  the clock. A clock time is now one value in claims and records alike: it
  supports a claim stating that time and nothing else; the date beside it
  still supports dates. Pinned by unit tests with a fixed 11:40 record.

## Phase 6c: the landing page in motion, and moving between pages (2026-10-19)

Built:

- **Hero**: the headline arrives word by word and, in the palettes with light,
  catches it (a slow sheen); the briefs below arrive one after another.
- **Try a theme**: five swatches under the hero re-skin the whole page in
  place. The choice is kept in this browser and offered -- not applied -- by the
  onboarding wizard after sign-up ("Keep Blueprint" / "No thanks").
- **Scroll story**: each drawing plays when its step is current -- slips fly in
  and settle, reports slide into one story, heat and confidence fill one after
  the other (never one bar), the explainer's lines write in and its citation
  pins pop. The dials in "Hot is not true" sweep to their values and the
  numbers count up; a screen reader hears the value, never the count.
- **Small motions**: primary buttons catch a sheen when pointed at (not in
  Newspaper), questions open to their answer, dialogs and the search palette
  rise in and fall away, the rail eases between widths.
- **Page transitions** (React `<ViewTransition>` in a template per section):
  the content leaves quickly and the next arrives gently, under a frame that
  holds still. Calm crossfades; Reduced and the OS setting change the page at
  once.
- The unused `motion` package is removed: everything here is CSS and the
  browser's view transitions.

Verified:

- `pnpm verify` green: unit 215, components 40, integration 159, e2e 431
  (6.7 min) including `p6-landing.spec.ts` (the strip, its hand-off, the
  onboarding offer saved to the account, the questions, navigation) and the
  reduced-motion project (headline, scenes and dials drawn finished; the strip
  works without a transition). Budget: shared 167 KB, all chunks 440 KB.
- Screenshots read: the landing page in Aurora and Newspaper, day and night,
  1440 and 390. Fixed from them: the headline's sheen showed almost no colour
  at rest.

Not done:

- A pointer-following tilt on cards was planned; cards lift on hover instead.
- The "front page, live" list does not cycle its headlines; it shows the six
  real ones, which already fills the column.
- The interest picker further down keeps its square chips.

## Phase 6 in production (2026-10-19)

- First push (`3b22120`): CI was cancelled at its 25-minute limit. Two causes,
  both fixed in `b4ad298`: theme tests clicked the picker before hydration (the
  click checked a native radio and saved nothing), and the section heatmap
  ordered ties by Postgres's grouping order, so a section could drop out.
- `b4ad298`: CI green (about 19 minutes -- close to the 25-minute job limit;
  the theme accessibility matrix is the largest addition). Deployed from a
  clean clone with `vercel deploy --prod`. `/api/health` reports `di_app`,
  row security enforced and commit `b4ad298`; the production smoke suite
  passed 28 of 28. The live landing page wears Aurora by day and by night.

## Own dropdowns and alerts (2026-10-19)

- **Select** (`components/ui/select.tsx`): the paper's own dropdown in place of
  every native `<select>` (onboarding, interests, alert rules, reading
  settings, the report dialog). A combobox and a listbox to the ARIA pattern:
  arrows, Home/End, Enter, Escape, type-to-jump; a search box from eight
  choices; options named by their label and described by a second line;
  themed, animated, 44px on touch; a hidden input keeps form submissions.
- **Alert** (`components/ui/alert.tsx`): neutral, info, success, warning,
  danger and breaking, each with an icon and words; title, actions, optional
  dismiss; announced only when asked (`live`). Replaces the hand-styled boxes:
  the edition-not-set-up notice, limited coverage, sign-in errors and notices,
  the sample-edition banner, the legal-page notices, the admin tick warning.
- Both are on `/dev/tokens`, so axe measures them in all 20 looks.
- Found by e2e and fixed: the dropdown opened under a dialog's overlay (a new
  `--z-dropdown` above it), and an option with a second line was named by both
  lines.
- Verified: `pnpm verify` green, e2e 431. Budget: shared 167 KB (unchanged),
  all chunks 489 KB (was 440: the popover the dropdown is built on, now on
  more pages).

## Phase 7a: a picture for every story (2026-10-19)

- **One resolver** (`src/lib/media/story-image.ts`): licensed photo, official
  video, AI illustration, map, then the section's cover art -- so every story
  has a picture and none has one it has no right to. Publisher photos are never
  a choice.
- **Cover art** (`components/news/cover-art.tsx`): an abstract drawing per
  section (17), arranged by the story's id with a seeded sequence (no
  `Math.random`), coloured only by theme tokens, never in the alert colour
  (a unit test renders every section and checks).
- **Maps** (`components/news/place-map.tsx`): Natural Earth's India-view
  boundaries, simplified by `pnpm geo` into a committed, server-only module;
  states as pins, not outlines; a map only when the place is reliable (a state,
  or exactly one country abroad). See `docs/MAP_DATA.md`.
- **Everywhere**: the story page hero, lead and standard cards, thumbnails in
  rows and in the Hot now and briefing columns. Captions say what each picture
  is ("Illustration · Cricket", "Map: Natural Earth").
- Verified: `pnpm verify` green, e2e 450 including `p7-images.spec.ts`;
  screenshots read in Aurora and Newspaper, day and night, desktop and phone.
  Fixed from them: GDELT's country list put Argentina on a story about the
  Pope (maps now need one country), small countries drew as shards, the
  sidebars had no pictures, and captions were read twice.
- Budget: shared 167 KB, all chunks 467 KB (pictures are drawn on the server).

## Phase 7b: licensed photos (2026-10-21)

- **NASA is cleared for media** (terms read again 2026-10-21 and quoted in the
  catalogue): its own imagery, from its own asset hosts only. Its insignia and
  logos are not public domain, and third parties' pictures it shows are marked
  with their holder, so `acceptMedia()` (`src/lib/ingestion/media.ts`) refuses
  a picture from any other host, one whose name, alt or caption points to a
  logo, and one credited to anyone but NASA -- in the pipeline, before storing,
  as excerpts are.
- The RSS adapter offers one candidate per item: a media element, or the first
  image in the item's HTML with its figure caption as the credit.
- Cards and the story page show it (`showableMedia()`, newest licensed picture
  in the story), through `/_next/image` from this origin; `next.config`'s
  remote hosts are held to the catalogue by a test.
- Tests: unit (extraction; the rule: own picture kept, ESA-credited and logo
  refused, other hosts and http refused, uncleared sources keep nothing),
  integration (a tick keeps NASA's own picture and drops the third party's;
  GDELT and PIB keep none), e2e (a seeded photo through the optimiser,
  credited "Photo: …"). The old "no image from any source" rule was replaced by
  this stricter one rather than deleted.
- YouTube thumbnails: allowed by its policies only with YouTube's official,
  unmodified logo linked to the video. Not built yet: waiting on whether to add
  the official logo asset.
- Local gate: interrupted by the machine sleeping and load spikes (timing
  tests ran for 14 minutes); each failing file passed when re-run alone. CI is
  the run of record.

## Phase 7c: AI illustrations (2026-10-21)

- **Vercel Blob** store `daily-intelligence-images` (public, sin1) created and
  connected to production, preview and development (`BLOB_READ_WRITE_TOKEN`).
- **Models, measured with this account**: FLUX.1-dev draws 1344×768 in ~5s;
  Stable Diffusion is not available and FLUX.1-schnell timed out. Nemotron VL
  checks a picture in ~1.5s and caught a photoreal picture with text in it;
  both Llama vision models timed out.
- **`story_images`** (migration 0012) with row security (0013): readers see
  `ready` rows only. One `ai_images` switch, `IMAGE_DAILY_LIMIT` (100/IST day).
- **The job** runs at the end of the AI pass: recent top stories with no
  licensed photo, not in a sensitive section, not about violence, conflict,
  crime, death or disaster. Draw, check (eight questions; any yes refuses),
  upload only if it passes, record. Failures are counted (`failed`,
  `lastError`) so a provider outage does not read as "nothing to do". The
  retention purge deletes a purged story's files from Blob after commit.
- **Found in the live trial and fixed**: NVIDIA's filter refused every prompt
  carrying the first style sentence (re-worded and measured); the first live
  picture drew armed men advancing on a photographer for an attack story
  filed under Business -- removed from Blob and the database, and the
  headline screen and the weapons/confrontation questions added. The next run
  drew two clean pictures and refused one with text and a flag in it.
- Tests: unit (prompt: no names, no excerpt, sensitive and violent stories
  refused, measured wording; verdict: any yes, a missing answer or bad JSON
  refuses), integration (drawn and shown; refused twice: nothing uploaded,
  invisible to readers; skipped for sensitive sections and licensed photos;
  switch; no second picture; retention removes the file), e2e (the label on
  the picture and in the caption, served through /_next/image).
- **After deploying 7c (`e49e3c9`)**: the Tick ran and drew nothing -- the
  explainers had used 47 of the AI pass's 50 seconds, and illustrations ran on
  what was left. Illustrations are now their own job (`/api/cron/illustrate`,
  `illustrate` in job_runs) with their own budget, called by the Tick after the
  AI pass, paused by either the `ai` or the `ai_images` switch, and a run that
  stops early says why (`stoppedFor`). The e2e suite points the image model at
  its stand-in and the store at a placeholder, because `next start` would
  otherwise read the real Blob token from .env.local.
