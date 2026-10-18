# Daily Intelligence — Product & Engineering Blueprint for Claude

**Document purpose:** Build a polished, production-minded, AI-powered news intelligence platform with a premium web experience, personalisation, hot-story ranking, and permitted social-media signals using a free-first source strategy.

**Product name:** Daily Intelligence  
**Suggested tagline:** *Know what matters. Understand why.*  
**Product type:** Responsive web app + installable PWA, designed so a native mobile app can be added later.  
**Preferred deployment:** Vercel  
**Preferred database:** Neon Postgres  
**AI provider:** NVIDIA API/NIM, behind a provider abstraction  
**Primary market:** India, with global coverage from day one  
**Default timezone:** Asia/Kolkata, while storing all timestamps in UTC

---

## 0. Instructions for Claude — Read Before Coding

Act as the lead product designer, staff engineer, data engineer, and AI product engineer for Daily Intelligence.

1. **Inspect the existing repository first.** If this is a new repository, create the project cleanly. If there is an existing codebase, understand its patterns before changing anything. Reuse useful conventions from the user's other products where available, but create an original Daily Intelligence identity.
2. Treat this document as the product source of truth. Implement in phases, keep a working application at every phase, and do not stop after producing a static mockup.
3. **Do not fabricate live news.** Any demo content must be clearly marked as demo/sample content. Real content must include source, canonical URL, source publication time, ingestion time, and provenance.
4. Never pretend a provider delivers instant or universal coverage. Show freshness and provider status honestly. Build resilient adapters, retries, deduplication, and graceful fallback behavior.
5. Never scrape private social content, bypass a platform's access restrictions, or assume that Instagram/X expose all public posts to third-party applications. Use approved APIs, RSS feeds where permitted, official embeds/oEmbed, or links. Confirm current commercial-use permissions and pricing before enabling a connector in production.
6. Do not copy or republish full copyrighted articles unless the relevant license explicitly permits it. Build original, attributed explainers from licensed input, allowed metadata, and multiple source links. Respect each provider's caching, attribution, removal, and retention rules.
7. Never expose secrets in the browser bundle, source control, logs, prompts displayed to the user, or generated files. All provider keys belong in server-only environment variables.
8. Use accessible responsive UI, working loading/empty/error states, optimistic UI only when safe, tests for critical logic, and useful README/setup instructions. Avoid placeholder buttons and dead-end screens.
9. When an external API key is absent, use a clearly labelled demo mode or a useful setup screen—not fabricated data presented as real. The app should still boot and be demonstrable.
10. After each phase, run lint, type checks, tests, and build. Fix failures before continuing. Do not claim a test passed unless it was run.

## 1. Product Vision

Daily Intelligence is a personalised information dashboard that combines trusted journalism, official announcements, niche sources, and eligible social conversation into a readable, explainable feed. It should help a user answer:

- What is happening right now in India and globally?
- What is the hottest story, and why is it trending?
- Which stories match my interests?
- What is confirmed, disputed, developing, or still unknown?
- How do reputable sources differ in their coverage?
- What is the concise explanation, background, impact, and next thing to watch?
- What are people discussing on eligible social platforms, with the original post and context easy to inspect?

### Core promise

**A personalised live intelligence desk—not just a list of headlines.**

### Product principles

- **Timely, not falsely instant:** display actual timestamps and source freshness.
- **Evidence before eloquence:** every factual briefing is traceable to source links.
- **Personalised, not trapped in a bubble:** show chosen interests and meaningful discovery beyond them.
- **Hot does not mean true:** viral volume and factual confidence are separate signals.
- **Transparent AI:** label AI-written summaries, show citations, and communicate uncertainty.
- **Reader first:** fast scanning, excellent typography, unobtrusive motion, no noisy interface.
- **India + global by design:** region, language, country, and category are first-class filters.
- **License-aware:** adapters must honour source terms, data rights, attribution, caching and deletion requirements.

## 2. Brand & Visual Direction

A generated logo concept is supplied alongside this plan as `daily_intelligence_logo_concept.png`. Use it as visual inspiration, not as a substitute for implementation-ready assets. Recreate the mark as clean SVG or vector components for small-size clarity; do not ship a raster mockup as the only logo.

### Logo concept

- Geometric “D” mark suggesting Daily.
- Globe / orbit / signal rings suggesting worldwide information and live updates.
- Three compact bars or a small amber signal suggesting ranking and intelligence.
- Readable wordmark: **Daily Intelligence**.
- Prepare standalone icon, horizontal wordmark, monochrome, light-background, dark-background, favicon, and app-icon versions.

### Visual personality

Premium editorial publication meets modern data dashboard. Calm, sharp, confident, and information-dense without looking cluttered. Avoid generic template-dashboard styling, exaggerated glassmorphism, excessive gradients, and dozens of glowing borders.

### Suggested design tokens

Use CSS variables/design tokens so the entire app can be themed consistently.

- **Primary navy:** `#0B1220`
- **Deep surface:** `#111B2E`
- **Primary blue:** `#2563EB`
- **Intelligence cyan:** `#06B6D4`
- **Signal amber:** `#F59E0B`
- **Success:** `#16A34A`
- **Critical / breaking:** `#DC2626`
- **Light canvas:** `#F6F8FC`
- **Light surface:** `#FFFFFF`
- **Light text:** `#111827`
- **Secondary text:** `#64748B`
- **Dark canvas:** `#080D17`
- **Dark surface:** `#101827`
- **Dark text:** `#E5ECF5`

Use meaning-based theme tokens (background, foreground, muted, border, card, primary, destructive) instead of sprinkling raw hex codes throughout components. Check contrast in both themes.

### Typography and spacing

- Use a modern, highly readable sans-serif for UI (e.g. Geist/Inter-like family), with editorial headline scale and generous line-height.
- Use a responsive 4/8-point spacing system, clear hierarchy, restrained shadows, 12–18px surface radius as appropriate, and consistent icon sizing.
- Make article text comfortable to read, not dashboard-small. Support adjustable text size.
- Use motion for state changes, story timelines, charts, and skeleton transitions—not to animate every element.
- Respect `prefers-reduced-motion` and provide a low-motion setting.

## 3. Main Navigation & Information Architecture

Desktop layout: slim persistent sidebar + top command/search bar + flexible content area. Mobile layout: compact bottom navigation and slide-out filters. Tablet layouts should adapt gracefully.

Primary navigation:

1. **For You** — personalised mixed feed.
2. **Today** — editorial overview and today's briefing.
3. **Hot Now** — ranked developing stories.
4. **India** — national, state, city, government, business, and regional feeds.
5. **Global** — world regions and cross-border stories.
6. **Categories** — Cinema, Sports, Politics, Business, Technology, AI, Science, Health, Climate, World Affairs, Education, Gaming, Lifestyle, and custom topics.
7. **Social Pulse** — eligible social posts, video links, discussion signals, and conversation context.
8. **AI Briefings** — daily, topic, region, and custom briefing pages.
9. **Saved** — bookmarks, collections, and reading history controls.
10. **Explore / Search** — topics, people, organisations, events, publishers, and source directories.

Persistent global controls: search/command palette, India/Global scope selector, notifications, theme toggle, and user profile/settings.

Keep navigation configurable; do not overload the mobile bottom bar. On mobile prioritise For You, Hot Now, Search/Explore, Saved, and Profile, with the remaining items inside the navigation sheet.

## 4. Registration, Onboarding & Personalisation

### Authentication

- Support Google and GitHub OAuth; add email verification or magic-link sign-in.
- Keep auth provider implementation modular (Auth.js/another maintained provider may be selected after checking compatibility with the repository and current docs).
- Include session expiry, sign out, sign out all sessions where supported, account deletion, and clear privacy information.
- Do not request unnecessary personal data.

### First-run onboarding flow

Build a visually polished 4–6 step flow with a visible progress indicator, back navigation, skip/continue where reasonable, and the ability to change everything in Settings later.

**Step 1 — Choose your coverage**
- India, Global, or Both (default Both).
- Optional states/cities/regions of interest.
- Country/region chips with searchable selection.

**Step 2 — Pick your interests**
- Categories: Cinema & Entertainment, Cricket, Football, Other Sports, Indian Politics, World Politics, Business & Markets, Startups, AI, Technology, Science, Space, Health, Climate, Gaming, Education, Lifestyle, and custom topics.
- Allow a user to select many categories and mark up to three as “Top priorities.”
- Do not make politics, health, religion, or other sensitive personal inferences from browsing. Save explicit choices only when appropriate and allow removal.

**Step 3 — Choose topics, teams, people, and sources**
- Optional followed entities, sports teams, film industries, actors/directors, companies, technologies, publications, and keywords.
- Provide skip and search. Do not block onboarding if no choices are made.

**Step 4 — Language and reading style**
- Default English; architect for Tamil, Hindi, and additional languages.
- Options: concise, balanced, deep-dive; show original language / translated summary preference.
- Clearly label machine translation where used.

**Step 5 — Notification preferences**
- Explain the value first; request browser notification permission only after a clear user action, not on page load.
- Options: Breaking only, Hot stories, Topic alerts, morning briefing, evening briefing, or none.
- Let the user choose quiet hours and maximum alerts per day.

**Step 6 — Your starter feed**
- Show a preview of the personalised feed, with visible “Why this is in your feed” explanations.
- Let the user adjust interests immediately.

### Personalisation controls

- Reorder categories and prioritise topics.
- Follow / mute / block topics, people, publishers and keywords.
- Select India/Global default and region.
- Reading history on/off; clear history.
- “Show me less like this” and “More like this.”
- Distinguish explicit likes from inferred relevance. Provide explanations and reset controls.

## 5. Core Screens and Behaviours

### 5.1 For You — primary home

Design an outstanding information-dense but calm home screen with:

- **Top story / breaking rail:** highest-confidence major developing stories. Use a strong but restrained status treatment.
- **Your Briefing:** 5–10 key items selected for this user, reading time, and “catch me up” summary.
- **Hot Now module:** ranked story clusters with heat score trend, source count, and first/last seen times.
- **India / Global toggle:** preserve current position when possible.
- **Category strips:** horizontal filter chips that work well on touch.
- **Mixed content cards:** hero cards, compact list rows, video cards, social signal cards, and “What changed?” updates.
- **Diverse discovery:** include a small amount of worthwhile coverage outside the user's most frequent topics.
- **Freshness label:** e.g. “Updated 2 min ago” based on actual ingestion/update time; never hardcode it.
- **Refresh behaviour:** preserve scroll, avoid duplicate cards, and show an unobtrusive new-stories banner instead of jumping the page.

Use a thoughtful card hierarchy rather than rendering every story as the same rectangle. Images must use source-licensed or otherwise permitted media with sensible fallbacks.

### 5.2 Hot Now

- Rank story clusters, not just individual URL variants.
- Show a heat indicator, direction (rising/stable/cooling), category, geography, first detected time, recent update time, and count of independent sources.
- Explain “Why trending” using measurable signals: rising article velocity, independent source spread, permitted social engagement velocity, and recency.
- Separate **trend heat** from **source confidence**. A story can be viral but unverified.
- Filters: India / Global, category, region, time range, verified-source minimum, and rising-only.
- De-emphasise or merge duplicates and repetitive low-quality content.

### 5.3 India

- National overview plus states/regions and optional city-level topics.
- Sections for government/policy, politics, business, cinema, cricket/sports, technology/AI, and public-interest updates.
- Include official notices/releases when relevant, clearly distinguished from reporting and commentary.
- Support India-relevant local time display and local-language summaries as providers allow.

### 5.4 Global

- Regions: North America, Latin America, Europe, Middle East, Africa, South Asia, East Asia, Southeast Asia, Oceania.
- Topic filters and country selection.
- Clearly label event location separately from publisher location.
- Do not infer an article's geographic relevance from publisher country alone.

### 5.5 Category pages

Each category page gets its own hero, top stories, emerging stories, latest feed, relevant followed topics, and trend chart. For cinema include film industries and release/news topics; for sports include competition/team filters and live-score integration only when an authorised data provider is configured; for AI include models, labs, research, product releases, policy, and safety.

### 5.6 Article / story intelligence page

A story should have a rich but readable page with:

1. Original headline and a clear AI-generated/AI-assisted label where applicable.
2. Category, geography, source, original publication time, and last verified update.
3. A compact **At a glance** summary.
4. “What happened” with concise facts.
5. “Why it matters” with impact and affected groups.
6. “What we know / what remains unclear” for developing or contested events.
7. A chronological timeline of verified updates.
8. “What changed since your last visit” when there is genuinely new sourced information.
9. Multiple-source panel with source names, timestamps, links, and distinct-source count.
10. “Coverage comparison” where independent sources materially differ; do not manufacture disagreement.
11. Related stories and background explainers.
12. Social conversation links/embeds only when the platform permits them.
13. Save, share, copy link, adjust font, listen/read-aloud, feedback, and report issue actions.
14. A prominent **Open original source** action.

Do not present the AI briefing as the original publisher's text. Never remove attribution or bury source links.

### 5.7 Social Pulse

A mixed view of eligible public conversation around the same story cluster:

- Clearly distinguish a news article from a post, official statement, creator video, commentary, and user-generated content.
- Display platform, account/creator when permitted, posted time, original link, and media preview if allowed.
- Provide “Conversation is accelerating” only when supported by an observed baseline.
- Offer filters by platform, topic, region, language, and verified/official accounts where the platform exposes trustworthy verification data.
- Label content as commentary/opinion when known; do not treat engagement as evidence of truth.
- Embed using official supported embed mechanisms where feasible. Do not download and rehost protected media by default.

### 5.8 AI Briefings

- Morning briefing, evening recap, category briefing, custom topic briefing, “since I last checked,” and a rapid catch-up for a major story.
- User selects time, timezone, scope, language, and length.
- Briefings include linked cited items, generated-at timestamp, period covered, and clear caveats if source coverage was incomplete.
- Do not say “all news” when the ingest sources are partial.
- Store generated output with the source IDs and prompt/model version needed for auditability.

### 5.9 Search / Explore

- Global search over story title, entity, topic, publisher, event, and permitted social record.
- Tabs: Top, Latest, Stories, Sources, Topics, People/Entities, and Social.
- Search filters: date/time range, India/Global, category, language, source, and verified-only.
- Query suggestions and recent searches with a clearable history.
- Semantic search can be added using embeddings after basic Postgres full-text search works.

### 5.10 Saved / Collections

- Bookmark stories and create collections/folders.
- Reading history on an opt-in or clearly disclosed basis.
- Mark read/unread; save an article with its source links and summary snapshot only to the extent allowed by applicable rights.
- Optional private notes on saved items.

### 5.11 Settings

Provide a complete settings centre, not a single generic page:

- Account, profile, sign-in methods, security, sessions.
- Interests, topics, sources, blocked/muted items, and followed entities.
- India/global defaults, location/region choices, language and translation preference.
- Theme: light, dark, system; optional accent selection if design remains coherent.
- Text size, compact/cozy density, animation/reduced motion.
- Push alerts, email digest, quiet hours, topic-specific rules, alert cap.
- Data controls: history, personalisation, download data, clear history, delete account.
- Privacy policy, terms, source attribution, AI policy, content reporting.
- Connection/provider status should be an **admin-only** operational view, not a user preference.

## 6. Free-First News Sources, Social Platforms & Realistic Freshness

**Hard requirement: do not depend on a paid news aggregator or paid social API for the MVP.** Do not add GNews, NewsAPI, NewsData.io, X, Instagram, or Reddit as core ingestion dependencies. Free tiers that have large delays, development-only terms, or commercial-use conditions are not suitable foundations for a live public news product.

No-cost access does not automatically grant copyright or redistribution rights. A source is enabled only after its URL, terms, permitted fields, attribution requirements, retention period, and commercial-use suitability have been checked. For publisher content, default to the headline, allowed excerpt/metadata, source name, timestamps, and canonical source link. Never mirror full articles or media without an explicit licence.

### 6.1 MVP shortlist — use these first

| Priority | Source | What it is best for | Cost / freshness reality | Implementation rule |
|---|---|---|---|---|
| P0 | **GDELT Project DOC 2.0 / GKG** — https://www.gdeltproject.org/ and https://api.gdeltproject.org/api/v2/doc/doc | Broad global story discovery, country/language coverage, matching related articles and monitoring topic volume | Public project data; GDELT 2.0 data products update on an approximately 15-minute cycle. This does not mean every publisher article is available immediately or every source is represented. | Use for discovery, candidate story clusters, article URLs and trend velocity. Preserve publisher links. Validate quotas and query limits; do not treat GDELT results or machine extraction as verified facts. Original publishers’ terms still apply. |
| P0 | **Direct publisher RSS/Atom feeds, source by source** | Fresh headlines, publisher timestamp, category and source diversity | Usually no API key or subscription for a public feed, but each publisher sets its own access and reuse terms. Feeds may expose only headlines/excerpts and may be delayed or incomplete. | Create a curated allowlist; verify each feed URL with a health check; store rights flags. Do not assume RSS grants commercial republication rights. Exclude personal/non-commercial-only feeds from a public/commercial deployment unless written permission is obtained. |
| P0 | **Official public-sector and primary-source feeds** — begin with [PIB RSS](https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=22) and its [copyright policy](https://www.pib.gov.in/ContentPage.aspx?lang=1&menuid=794&reg=23) | Indian government announcements, policies, ministry statements, public-sector facts | Direct public RSS; no aggregator key needed. PIB permits reproduction of material featured on its site with prominent acknowledgement, but that policy excludes third-party materials and requires accurate, non-misleading use. | Tag as `official_statement`, not independent journalism. Keep direct attribution and link. Do not let an official release alone masquerade as independently verified reporting. Add other regulators, courts, election authorities, scientific agencies, sports bodies, and company newsrooms only after checking their own policies. |
| P1 | **Official AI / science / research feeds** — e.g. [arXiv RSS/Atom](https://github.com/arXiv/arxiv-docs/blob/develop/source/help/rss.md), official lab/company blogs and release feeds | AI papers, research releases, model/product announcements and technical updates | arXiv RSS/Atom feeds are free and updated daily, not a breaking-news service. Company/blog RSS availability varies and must be verified. | Create explicit sources for AI subfields and research categories; distinguish peer-reviewed work, preprints, company claims, benchmarks, and independent reporting. Link to the original paper/release. |
| P1 | **Bluesky public AppView API** — https://docs.bsky.app/docs/api/app-bsky-feed-get-feed | Public posts, expert/creator conversation, emerging discussion and links to original posts | Public read endpoints exist without a token; public services still impose rate limits and operational limits. | Use for an opt-in `Social Pulse` signal, not as a factual authority. Attribute the author and link to the post. Prefer followed/curated public accounts and topic queries; apply spam/coordination filtering. |
| P1 | **Selected Mastodon public timelines and hashtags** — https://docs.joinmastodon.org/methods/timelines/ | Public community conversation from selected instances and topic tags | No-cost public API on many instances; each server controls access and applies rate limits. It is decentralised and is not a complete global search index. | Configure an explicit instance list; track the instance and its last-success time. Respect each instance’s access controls, deletion/visibility states, rate limits, and user privacy. |
| P1 | **YouTube Data API v3** — https://developers.google.com/youtube/data/v3 and [quota details](https://developers.google.com/youtube/data/determine_quota_cost) | New videos and metadata from official newsrooms, sports channels, creators and research channels | No-cost default quota, but constrained: Google documents 100 `search.list` calls/day and 10,000 units/day for most other methods. Quotas can change. | Track a curated channel catalogue and use inexpensive channel/video lookups where appropriate. Do not run broad search for every user refresh. Use official YouTube embeds/links; do not download or re-host videos. |
| Optional, if eligible | **football-data.org free tier** — https://www.football-data.org/ | Basic football fixtures, results and tables for supported competitions | Limited free tier; current docs list 12 competitions and 10 requests/minute. It is football-only, and assets/logos may have separate rights. | Enable only after confirming current terms for the intended app and deployment. It does not solve live cricket, tennis, F1, basketball and every other sport. For other sports use permitted official feeds and attributed news links. |

### 6.2 Explicitly exclude from the free-first production core

- **GNews free tier:** official pricing says 100 requests/day, up to 10 articles/request, a 12-hour delay, and the free plan is for development/testing rather than commercial published projects. Do not use it for hot-news alerts. https://gnews.io/pricing
- **NewsAPI Developer plan:** 100 requests/day, articles delayed by 24 hours, and the terms restrict the free Developer plan to development/testing—not staging or production. Do not use it as the live app’s backbone. https://newsapi.org/pricing and https://newsapi.org/terms
- **NewsData.io free tier:** 200 credits/day, up to 10 results per free request, and a 12-hour delay. It can be useful for comparison during prototype testing but is not suitable for the real-time Hot Now feed. https://newsdata.io/pricing
- **X:** exclude direct ingestion from the free-first MVP. Current official access is usage-priced for read resources, so broad trend/post coverage is not a dependable no-cost assumption. https://developer.x.com/
- **Instagram:** exclude broad public-post ingestion. Meta’s APIs are permission- and account-type-limited; they are not a general unrestricted index of every public consumer post. Use an authorised account integration or permitted official embed/share link only. https://developers.facebook.com/docs/instagram-platform/
- **Reddit:** do not rely on free API access for a public/monetised product without reviewing the current terms and obtaining any required separate agreement. Reddit’s terms reserve the right to charge for commercial use, and developer terms restrict business/monetised use unless expressly permitted or approved in writing. https://redditinc.com/policies/data-api-terms and https://redditinc.com/policies/developer-terms
- **TheSportsDB free key:** do not use it for a released app unless the current terms explicitly allow it; its current terms state that free API usage is for development projects and app-store publication requires a paid subscription. https://www.thesportsdb.com/docs_terms_of_use.php

These exclusions do not mean those networks have no value. They mean a sustainable, no-cost launch should not depend on unrestricted access the platforms do not grant. Social cards can still link to permitted original URLs or use supported embeds where allowed; never scrape private pages or bypass access controls.

### 6.3 RSS and source catalogue requirements

Seed the app with a small, high-quality catalogue instead of hundreds of unverified feeds. Organise it by India, global region, language, category, and source type. For every source record store:

- `source_name`, `canonical_domain`, `source_type`, `feed_url`, `country_or_region`, `language`, `categories`, and optional official/primary-source designation.
- `terms_url`, `rights_checked_at`, `commercial_use_allowed`, `headline_display_allowed`, `excerpt_display_allowed`, `ai_summary_allowed`, `media_reuse_allowed`, `retention_policy`, required attribution text, and removal/contact path.
- `poll_interval_seconds`, `etag`, `last_modified`, `last_success_at`, `last_error_at`, `health_status`, and observed freshness metrics.
- `enabled` and `disable_reason`; any unclear rights state defaults to disabled for public display until manually reviewed.

Do not hard-code a publisher as permitted simply because it has an RSS endpoint. For example, The Indian Express publishes RSS feeds but its RSS page states personal/non-commercial use, so that feed must not be enabled for a public/commercial product without written permission. https://indianexpress.com/rss/

### 6.4 Freshness model and truthful UI

Every item should track at minimum:

- `published_at`: source-reported original publication time.
- `source_updated_at`: source’s update time if provided.
- `ingested_at`: when Daily Intelligence first retrieved the item.
- `last_checked_at`: when the source/record was last checked.
- `story_last_updated_at`: most recent evidence-backed change to the story cluster.
- `ai_generated_at`: when the current generated summary/briefing was produced.

Do not replace publication time with ingestion time. Display timestamps clearly, e.g. “Published 18 min ago · Detected 2 min ago.” If source timestamps are missing or uncertain, say so. Expose a per-source freshness status in Admin and, when useful, in Story Details.

### 6.5 Refresh and real-time architecture

- Start with a refresh schedule based on actual source capabilities: use a few-minute polling interval only for high-priority feeds where permitted; stagger lower-priority RSS, research and official feeds to avoid waste. GDELT itself updates on its own cycle; more frequent polling does not make upstream data arrive faster.
- Use server-side background jobs rather than fetching every provider on a page load. Implement `ETag`/`If-Modified-Since` for feeds where supported, request caching, per-domain pacing, exponential backoff, jitter, circuit breakers and provider kill switches.
- Queue ingestion, normalisation, deduplication, clustering, ranking, AI enrichment and notification delivery as separate idempotent jobs.
- Use SSE or controlled polling to refresh client feeds; avoid WebSockets unless bidirectional communication is genuinely required.
- Do not build a one-minute job system on a hosting plan that only supports infrequent scheduled jobs. Verify the current plan’s scheduler and worker limits before committing to a refresh SLO.
- Define a realistic target per connector and display a degraded/stale state when upstream sources stop updating. Never market it as “every news story instantly.”

### 6.6 Free-source MVP recommendation

Launch with **GDELT + a quality-controlled RSS/Atom allowlist + official primary sources**, then add **Bluesky, selected Mastodon instances, and a curated YouTube channel catalogue** behind independent adapters. Use NVIDIA only for server-side summarisation/classification/briefings according to the user’s existing access and quota; source ingestion should still function if the AI provider is unavailable.

Do not block MVP launch waiting for X/Instagram/Reddit or broad live scores. Show a transparent source directory and coverage note so users understand that the product aggregates a growing, selected source network rather than literally every story on the internet.

## 7. Hot-Story Ranking & Personalised Feed

Create a transparent ranking service. Avoid one opaque “AI decides” score.

### Separate scores

1. **Global heat score (0–100):** how quickly and broadly a story is gaining attention.
2. **Source confidence score:** strength, independence, and consistency of the available evidence.
3. **Personal relevance score (0–100):** how well the story matches explicit interests, selected regions, followed entities, and reading preferences.
4. **Editorial importance score:** severity/public impact, official alerts, and other defensible signals. Do not let raw engagement determine this score.

### Candidate global heat calculation

Use a documented initial heuristic, tune it using measured outcomes, and store component scores for explanation. Example starting weights (normalised to 0–1):

- 30%: article/post velocity change compared with its own recent baseline.
- 25%: independent source spread and story-cluster growth.
- 18%: recency with time decay.
- 15%: permitted engagement velocity, normalised by platform/source where available.
- 12%: cross-region or cross-category spread, when contextually relevant.

This is a starting hypothesis, not an objective measure of importance. Do not mix confidence into heat as though virality proves truth. Preserve a separate evidence/confidence dimension.

### Personal relevance candidate

- 35% explicit interests and top-priority topics.
- 20% followed entities or keywords.
- 15% selected geography and India/Global preference.
- 15% user feedback (`more`, `less`, save, mute) with decay.
- 10% preferred languages and reading format.
- 5% beneficial discovery/diversity signal.

Use these weights only as a starter; make them configurable and monitor for harmful filter bubbles. Explicit user selections must outrank uncertain inferences. Do not infer sensitive traits.

### Ranking requirements

- Apply recency decay and avoid endlessly resurfacing old viral items.
- Deduplicate syndicated/canonical variants before ranking.
- Limit repetitive publisher/topic runs in the feed.
- Enforce minimum diversity while preserving breaking and highly relevant content.
- Show “Why you’re seeing this” / “Why trending” based on recorded score components.
- Track a ranking-version value so results can be compared after tuning.
- Avoid engagement loops that reward outrage, misleading claims, or repeated low-value content.

## 8. AI Intelligence Layer — NVIDIA Integration

Use NVIDIA's available hosted API/NIM endpoint for eligible models behind a **server-only AI provider interface**. Verify the current account endpoint, available models, usage limits, and billing before selecting the production model. NVIDIA's current documentation exposes chat-completions-style APIs for supported hosted/self-hosted setups; the exact compatible endpoint and model names should be configurable, not hardcoded into business logic.

### AI capabilities

- Headline cleanup/normalisation (retain original headline and source).
- Category, region, language, named entity, topic, and event extraction.
- Duplicate/stories clustering support, combining semantic similarity and deterministic rules.
- Short summaries and structured article explainers.
- “Why it matters,” background context, timeline, key players, and possible implications.
- Daily/morning/evening briefing synthesis from selected source-backed stories.
- Cross-source comparison with a source matrix.
- Translation/localisation with language labels.
- Text-to-speech preparation / read-aloud integration if selected.
- On-demand “Ask about this story” chat constrained to the story's recorded source bundle.
- Topic trend descriptions based on measured trend data.
- Social conversation summaries only where source access/terms allow and clearly label commentary.

### Grounding and factuality guardrails

- The model may only describe claims supported by the supplied source records unless it explicitly identifies a gap/uncertainty.
- Use structured JSON output with schema validation; reject malformed outputs.
- Each key factual claim in a generated briefing should cite at least one source URL/ID. Important claims should have more than one independent source when available.
- Store all source IDs used, prompt version, model name, generation time, and verification status.
- Ask the model to separate confirmed facts, attributed claims, analysis, and unknowns.
- Never use a generated explanation as proof that a story is true.
- If sources conflict, present the disagreement with attribution. Do not force false consensus.
- If a story has a low source count, label “Limited source coverage.”
- Mark AI-written content as “AI-generated summary” or “AI-assisted explainer.”
- Add automated checks for unsupported dates/numbers/names, links, repeated text, toxic content, and accidental source-copying. High-impact claims require stricter corroboration and optional admin review.
- Treat retrieved articles and social posts as **untrusted input**, not instructions. Prompt-injection text inside source content must never be treated as system or developer instructions.
- Fall back to a non-generative summary from provider metadata if the AI provider is unavailable.

### Article write-up style

Default article explainers should be original, concise, and useful—not full-length rewrites of source articles. Structure:

1. **In one minute** — two to four sentence summary.
2. **What happened** — facts with links.
3. **Why it matters** — context and likely effects, clearly distinguished from confirmed fact.
4. **Key details** — short bullet list.
5. **What happens next** — only if supported; phrase uncertain possibilities as possibilities.
6. **Sources and updates** — links and timestamps.

Length options: Brief (100–180 words), Standard (250–450 words), Deep Dive (700–1,200 words). Length limits should be configurable and never override source rights.

### Animations and generated videos

- Use lightweight motion graphics for timelines, score changes, maps, data trends, and explanatory diagrams.
- Do not generate a video for every article. It adds latency/cost and may create misleading or synthetic depictions of real events.
- Phase 3 option: generate a short **visual explainer** from source-verified facts using animated charts, timelines, maps, icons, captions and licensed assets. Label AI-generated media, link sources, and provide a text transcript.
- Never create realistic synthetic footage implying it depicts a real event unless verified authentic source footage and rights are established. Do not generate fake quotes, fake news footage, or invented eyewitness scenes.
- Queue video generation as an on-demand/priority job with cost controls and fallback to a static explainer card.

## 9. Architecture & Recommended Stack

Use a maintainable TypeScript-first modular monolith for the first version. Split background jobs/services where operationally needed; do not start with unnecessary microservices.

### Web application

- Next.js App Router + TypeScript.
- Tailwind CSS + a consistent shadcn/ui-style component system (or existing component conventions).
- Lucide icons.
- Framer Motion or CSS transitions for measured motion; respect reduced motion.
- TanStack Query or a consistent server/client caching pattern for interactive refreshes.
- A lightweight chart library for trend/analytics visuals.
- Responsive accessible layouts, semantic HTML, keyboard support, and robust image fallbacks.

### Data and server

- Neon Postgres as the main system of record.
- Drizzle ORM (or the repository's already established, maintained equivalent) with versioned migrations.
- Postgres full-text search first; consider `pgvector` for semantic retrieval after core search and data contracts are stable.
- API/server actions with schema validation and rate limits; never call privileged providers directly from client code.
- Background job queue/scheduler such as a suitable managed queue/orchestration platform or dedicated worker. Select based on the actual account, pricing and runtime constraints. High-frequency ingestion must not depend on browser traffic.
- Redis-compatible managed service only if needed for rate limits, short-lived caches, or queue state. Keep the database authoritative.
- Object storage (e.g. compatible object storage) only for media the product has rights to store, generated assets, and user uploads; do not mirror arbitrary publisher media.

### Authentication and notifications

- Maintained authentication library/provider with Google, GitHub, and email verification/magic-link options.
- Web Push / PWA notifications; consider a managed push provider if it reduces delivery and subscription complexity.
- For each browser subscription: ask explicit permission, allow revoke, handle invalid subscriptions, and avoid storing more metadata than necessary.
- Mobile later: evaluate Expo/React Native or native apps only after web/PWA usage validates the product.

### Deployment

- Vercel for web frontend and suitable server routes.
- Neon for Postgres.
- Separate scheduled/background execution path for ingestion and AI-heavy work where required.
- Development, preview, and production environments with separate keys/databases where practical.

### Suggested module boundaries

- `auth/`
- `onboarding/`
- `feed/`
- `stories/`
- `sources/`
- `ingestion/`
- `normalization/`
- `deduplication/`
- `story-clustering/`
- `ranking/`
- `personalization/`
- `ai/`
- `social/`
- `notifications/`
- `search/`
- `saved/`
- `settings/`
- `admin/`
- `analytics/`

Avoid circular dependencies. Provider integrations should implement clear interfaces; business rules must not depend on provider response shapes.

## 10. Data Model — Suggested Starting Schema

Claude should refine the schema after inspecting the codebase, but the following concepts must be represented explicitly.

### Core entities

- **users**: id, email, display name, image, locale, timezone, onboarding state, created/updated timestamps.
- **user_preferences**: user id, default scope, language, summary length, density, theme, text size, motion preference, personalisation toggle, history toggle.
- **user_interests**: user id, topic/entity/keyword, interest type, priority, explicit/inferred source, created time.
- **notification_preferences**: user id, breaking/hot/topic/digest switches, quiet hours, timezone, daily cap, category thresholds.
- **notification_subscriptions**: endpoint/token metadata, browser/platform, status, last success; store and access securely.
- **sources**: id, name, domain, source type, provider key, geography, languages, categories, trust metadata, licence/terms reference, enabled state.
- **provider_connections**: provider name, credential reference (never plaintext secret), quotas/config, health, last success/error.
- **raw_source_items**: source/provider ids, provider item id, canonical URL, title, description/snippet if permitted, language, published/updated/ingested timestamps, permitted media reference, raw metadata subject to retention rules.
- **stories**: canonical cluster id, headline, dek/summary, category, region/country, primary entity, first seen, latest update, state (`developing`, `active`, `cooling`, `closed`), generation provenance.
- **story_items**: story id, raw source item id, association confidence, first/last associated time.
- **story_updates**: story id, event/update text, evidence source IDs, occurred-at time, added-at time, verification status.
- **ai_briefings**: target story/topic/region, output sections, cited source IDs, model, prompt version, generated-at, status, token/cost metadata where available.
- **story_scores**: story id, score version, heat components, confidence components, importance, calculated-at.
- **user_story_feedback**: user id, story id, feedback type, timestamp.
- **bookmarks / collections / collection_items**: user-owned saved items.
- **notification_events**: user id, story id, type, reason, created/sent/delivered/opened time, suppression reason, dedupe key.
- **content_reports**: report reason, item reference, status, created-at, moderation result.
- **audit_events**: security- and admin-relevant actions, excluding secrets and unnecessary content.
- **ingestion_runs**: provider, start/end, records fetched, records processed, errors, quota info, status.

### Data integrity rules

- Use unique provider item IDs where supplied, plus canonical URL/domain normalisation for fallback deduplication.
- Store timestamps in UTC (`timestamptz`); convert to user timezone only at presentation.
- Index user feed preferences, story recency, cluster membership, source ID, category, region, and full-text searchable columns.
- Use retention policies by data type. Do not retain provider content indefinitely if the contract does not permit it.
- Store source IDs on every AI summary/briefing so every output can be reproduced or invalidated if an item is removed.
- Add idempotency keys for ingestion jobs and notification sends.

## 11. Ingestion, Deduplication & Story Clustering Pipeline

Create a visible, testable sequence:

1. Scheduler dispatches a provider ingestion job.
2. Adapter retrieves data within provider quotas and logs request metadata safely.
3. Validate response shape and timestamps; quarantine malformed results.
4. Normalize titles, URLs, domains, language, category, and geographic metadata.
5. Apply provider-specific rights rules and remove fields not allowed to persist.
6. Detect duplicates by provider ID, canonical URL, normalised title similarity, and optional embeddings.
7. Link duplicates/syndicated coverage to story clusters; allow an item to be re-clustered when later evidence improves matching.
8. Extract entities/topics and classify geography.
9. Recalculate heat/confidence scores for affected clusters.
10. Generate or refresh AI summaries only when material changes occur and budget allows.
11. Update cached feed/search data and push an internal “story updated” event.
12. Evaluate alert policies; queue deduplicated notifications if thresholds pass.
13. Record metrics, errors, source timestamps, and job duration.

### Failure handling

- Per-provider rate limiting, retry with exponential backoff and jitter, timeout controls, circuit breakers, and disable switches.
- Partial data should not break the entire feed.
- Use stale-but-valid cached data with a visible freshness indicator when a provider is unavailable.
- Dead-letter repeatedly failing jobs and show admin diagnostics.
- Job processing must be idempotent; replaying a batch must not create duplicates or send duplicate notifications.
- Keep an admin “dry run” for ingestion/ranking/notification policy.

## 12. Notification System — Useful, Personal, Never Spammy

### Notification types

- **Breaking:** exceptionally important, high-confidence story.
- **Hot story:** a sharp rise in relevant heat score.
- **Topic alert:** a followed topic/entity crossed a user-defined threshold.
- **Story update:** material new fact on a story the user saved or followed.
- **Briefing:** scheduled morning/evening digest.

### Suggested initial policy

- Default to notifications off until the user opts in, with a clear explanation.
- Start with a conservative maximum of 3–5 push alerts per user per day; user can adjust.
- Respect quiet hours and timezone.
- Collapse alerts for the same story cluster.
- Use cooldowns to prevent repeated notifications while a story score fluctuates.
- Suppress duplicate alerts already sent or seen unless the update is materially new.
- Require both user relevance and quality/importance thresholds for non-breaking notifications.
- Do not alert on virality alone. For uncertain stories, either wait for corroboration or label uncertainty clearly and apply stricter rules.
- Never send ads disguised as breaking news.

### Notification copy format

`[HOT NOW] [Topic] Short, factual headline`  
`Why it matters: one concise sentence. Updated from N sources.`

Notification links should deep-link to the correct story and preserve authentication navigation safely.

### Operational controls

- Store notification policy version, decision reason, score, suppression reason, and idempotency key.
- Add a global kill switch, per-user pause, provider incident suppression, and admin test-send mode.
- Separate “created”, “queued”, “sent”, “delivered if observable”, and “opened” states; don't claim delivery if the platform does not confirm it.

## 13. Rich Dashboards & Visual Intelligence

A genuinely useful dashboard should answer questions rather than just decorate the homepage.

### User-facing dashboard components

- **Global pulse:** story clusters rising fastest in the selected window.
- **Topic heatmap:** topic vs. time period, backed by observed data.
- **India vs. Global pulse:** distribution of stories in current filtered data, not a claim about all world news.
- **Emerging topics:** newly growing clusters with source count and confidence.
- **Your interests:** story activity across selected topics.
- **Story timeline:** sourced update events displayed chronologically.
- **Source diversity:** number of independent publishers/primary sources represented.
- **Reading dashboard:** saved stories, unfinished reading, and optional weekly recap.

For each chart, include a title, meaning, date range, units, hover/keyboard accessible values, and empty state. Use chart animations sparingly and never encode confidence with color alone.

### Admin/operations dashboard (role-protected)

- Provider status, API quota/usage indicators where available, last success, latency, error rates.
- Ingestion volume, duplicates, clustering failures, and queue depth.
- AI generation success, latency, rate limit/errors, and estimated cost if provider data supports the metric.
- Notification creation/send/suppression counts.
- Stale data alerts and configurable health thresholds.
- Source management, enable/disable, terms/reference links, and cadence configuration.
- Story cluster inspection and merge/split tooling with audit trail.
- Report queue and moderation actions.
- No public admin route or privileged action without role checks on the server.

## 14. Search, Cache & Performance

- Use Postgres full-text search and indexes as the initial search foundation.
- Add semantic embeddings only after the normalised source/story schema is working and measurable.
- Cache expensive public responses by scope/category/region where safe; keep personalised responses private to the user.
- Never cache private preferences/bookmarks in a shared public cache.
- Paginate feeds with stable cursors, not deep offset pagination at scale.
- Use responsive image sizing and lazy loading; don't block first content on AI enrichment.
- Render a useful shell immediately, stream or load sections progressively, and show skeletons where the shape is known.
- Measure Core Web Vitals, API latency, feed first-content time, and source freshness.
- Avoid calling every provider on every page view. Ingestion happens in the background; UI reads normalised internal data.

## 15. Safety, Trust, Privacy & Editorial Integrity

- Show source attribution clearly on every story and generated briefing.
- Distinguish reporting, opinion, official statements, sponsored content (if ever supported), and user-generated posts.
- Political coverage should not silently promote one viewpoint. Provide diverse coverage where possible, clear source provenance, and user-controlled filters.
- Do not automatically label a person or claim “fake” based solely on model output. Use “unverified”, “disputed”, “contradicted by cited sources”, or “fact-check review” with evidence and careful language.
- Develop a correction/removal pipeline and preserve an audit trail for changes.
- Have a visible report button for harmful, misleading, misattributed, or rights-related content.
- Don't generate synthetic quotes or infer statements from video/audio without verified transcription/context.
- Keep prompt-injection defense in the AI pipeline: provider text is untrusted data; no source may change tools, system policies, secrets, or access permissions.
- Apply least-privilege database access and server-side authorisation. Validate every user-controlled input.
- Use rate limiting for login, search, AI chat, reports, and expensive endpoints.
- Avoid logging credentials, full user tokens, or sensitive preference details.
- Provide privacy notice and clear account/data controls. Review relevant local privacy requirements before launch; this blueprint is engineering guidance, not legal advice.

## 16. Monetisation (Future, Not MVP)

Do not put monetisation ahead of content quality. Possible future models:

- Free tier with normal feed and limited AI deep dives.
- Premium plan for advanced briefings, unlimited story chat, custom alerts, extra languages, and deeper analytics.
- Team/workspace intelligence dashboard.
- Clearly labelled sponsorships only if they can remain visibly separate from editorial/news ranking.

Never sell alert priority to sponsors or allow advertisers to manipulate the heat/confidence score. Keep user interests private and don't share them with ad partners by default.

## 17. Implementation Phases

### Phase 0 — Repository audit & technical skeleton

- Inspect repository, dependencies, current design conventions, environment variables, deployment settings, and existing authentication/database patterns.
- Produce a short implementation checklist and architecture note.
- Create or refine app shell, theme tokens, route structure, layout primitives, logo SVG/icon system, and responsive navigation.
- Add lint/type-check/test/build scripts and CI-friendly commands.

**Acceptance criteria:** app starts locally; light/dark/system modes work; responsive shell works on desktop/tablet/mobile; no secret is committed; placeholder routes are intentional and clearly labelled.

### Phase 1 — Beautiful, data-driven MVP experience

- Implement sign-in and onboarding.
- Build For You, Today, India, Global, Hot Now, Category, Story detail, Search, Saved, Settings, and Admin shell.
- Create migrations and database models.
- Implement provider adapter interface, source registry, one chosen news provider, and a small curated set of permitted feeds.
- Implement normalisation, canonical URL dedupe, initial cluster association, pagination, timestamps, and source links.
- Create demo mode for environments without API keys, visibly labelled Demo.

**Acceptance criteria:** user preferences persist; filters affect results; story detail links to original source; no fabricated story is presented as live; theme preference persists; empty/error/loading states are designed and tested.

### Phase 2 — AI intelligence and story ranking

- Connect NVIDIA through a server-side adapter after validating endpoint/model access.
- Implement schema-constrained summarisation, category/entity extraction, source-linked AI explainer, and generation audit metadata.
- Implement heat, confidence, relevance, and importance as separate scores.
- Add story clustering, score explanations, “Why trending” and “Why in your feed”.
- Add generated daily/topic briefing and robust AI-offline fallback.

**Acceptance criteria:** summaries cite linked sources; failed or invalid model output falls back safely; no secret leaves server runtime; tests prove heat does not imply truth; score components and version are stored.

### Phase 3 — Freshness, live updates and notifications

- Add managed scheduler/queue or suitable worker for provider ingestion.
- Add per-provider pacing, retry/backoff, monitoring, circuit breaker, stale-source flags, idempotency.
- Implement live feed update signals (SSE or controlled polling).
- Build push subscription UX, topic rules, quiet hours, dedupe/cooldowns, daily caps, digest jobs, and unsubscribe/revoke behaviour.

**Acceptance criteria:** repeated batch ingestion is idempotent; a provider outage doesn't break all feeds; duplicate alert test passes; user receives no push without permission; configured quiet hours and alert caps are respected.

### Phase 4 — Social Pulse and richer dashboards

- Add connectors individually only after provider access and terms are verified.
- Start with permitted post URLs/embeds and approved APIs. Build platform-specific rendering rules.
- Add source-health admin dashboards, topic heatmap, timeline, cross-source comparison, and richer search.
- Consider semantic search and text-to-speech after usage/cost is understood.

**Acceptance criteria:** every social item identifies its platform and links to original; forbidden or unavailable platform access is not simulated; charts are accessible and reflect queried data; admin screens are server-role protected.

### Phase 5 — AI visual explainers, scale and native mobile decision

- Add on-demand motion-graphic explainers sourced from verified facts, plus transcript and source links.
- Add editorial review for high-impact cases where necessary.
- Load/performance test, privacy review, retention review, source-contract review, and abuse/rate-limit tests.
- Decide if native mobile applications are justified by product usage.

**Acceptance criteria:** generated media is labelled; the system has spending caps and job cancellation; source evidence is retained in allowed form; slow generation does not block articles or feeds; the app meets defined latency/freshness targets.

## 18. Environment Variables — Use Server-Only Secrets

Create `.env.example` with placeholder values only, and document every variable. Actual names should be confirmed against selected libraries and deployment services.

Potential variables:

```env
# Database
DATABASE_URL=

# Authentication (exact names depend on selected auth provider)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
EMAIL_SERVER_URL=
EMAIL_FROM=

# Free-first connectors: GDELT and RSS/Atom do not normally require API keys.
# GDELT uses a public endpoint; keep it configurable for tests.
GDELT_DOC_API_URL=https://api.gdeltproject.org/api/v2/doc/doc

# Optional free-quota connectors (server-only)
YOUTUBE_API_KEY=

# AI provider — confirm the current NVIDIA product endpoint and model names
NVIDIA_API_KEY=
NVIDIA_BASE_URL=
NVIDIA_MODEL=

# Job orchestration / scheduling (if selected)
JOB_SIGNING_SECRET=
QUEUE_CONNECTION_URL=

# Optional rate-limit/cache provider
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Optional web push (server-only private key)
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
WEB_PUSH_SUBJECT=

# Optional object storage for assets the app has rights to store
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
```

Do not require every possible provider to launch. Validate essential env vars at startup, but allow demo mode if providers are missing. Do not print the value of any key in logs. If the current NVIDIA product needs a different base URL or authentication convention, follow its latest docs and change configuration—not the AI business logic.

## 19. Testing Strategy

### Unit tests

- URL canonicalisation and duplicate detection.
- Region/category/entity normalisation.
- Heat/relevance/confidence score components and time decay.
- Personalisation filters and user feedback.
- Notification threshold, daily-cap, cooldown, quiet-hour, dedupe, and suppression rules.
- AI JSON-schema validation and citation completeness.
- Time conversion and “updated” labels.

### Integration tests

- Provider adapter with mocked valid/invalid/rate-limited/timeout responses.
- Ingestion replay without duplicates.
- Story cluster merge/split and source provenance.
- AI provider outage and malformed response fallback.
- OAuth callback and protected settings/routes.
- Push notification idempotency and subscription invalidation.
- Database migrations from a clean test database.

### End-to-end tests

- New user signs in, completes onboarding, and receives a personalised feed.
- User switches India/Global and category filters.
- Story opens with accurate source links and timestamps.
- User saves story, manages collection, edits interest, and mutes a source.
- User changes theme/text size/notification settings and preferences persist.
- Notification opt-in is permission-led and quiet hours suppress alerts.
- Admin routes reject non-admins.
- Mobile, tablet, keyboard-only, loading, empty, and error flows are checked.

### Editorial/AI evaluation set

Create a fixed set of diverse, legally usable sample input records covering breaking, disputed, low-source-count, syndicated, outdated, politically sensitive, and multilingual stories. Evaluate factual grounding, citation coverage, source attribution, hallucination rate, duplicate clustering, and headline quality. Never use synthetic test items as real live news.

## 20. Operational Metrics & Product Analytics

Track privacy-conscious, aggregated metrics:

- Active users and returning users.
- Onboarding completion and preference-edit frequency.
- Feed first-content latency and story-detail latency.
- Source freshness by connector and category.
- Ingestion success/error rate, dedupe ratio, cluster precision feedback.
- AI generation failure/latency/cost where known, and citation coverage.
- Notification opt-in, suppression reasons, open rate, mute/unsubscribe rate.
- Saves, “more/less like this,” searches, and user-reported relevance.
- Accessibility and runtime error rates.

Do not optimise only for time spent or push click-throughs. Optimise for useful reading, source diversity, low correction rates, user control, and appropriate freshness.

## 21. Definition of Done

A phase is not done merely because the screen looks finished. The relevant routes must work with real state, persistence, loading/empty/error cases, and responsive layouts. Relevant provider integration must use a real adapter or be labelled demo. All article/AI facts need provenance, API keys stay server-side, settings persist, tests/lint/type checks/build run successfully, and setup instructions are current.

Before presenting the work as completed, provide:

- What is implemented vs. planned.
- Commands run and whether each passed.
- Required environment variables and how to obtain them.
- Known provider/licensing/coverage limitations.
- Deployment steps.
- A concise list of remaining high-priority work.

## 22. Official References to Recheck Before Production

Use current documentation, as terms/pricing/limits can change. These links are starting points; do not treat them as a substitute for reviewing the exact commercial plan and applicable agreement.

- GDELT Project data and query documentation: https://www.gdeltproject.org/ and https://api.gdeltproject.org/api/v2/doc/doc
- GDELT 2.0 data cadence reference: https://www.gdeltproject.org/data.html
- PIB RSS directory: https://www.pib.gov.in/ViewRss.aspx?lang=1&reg=22
- PIB copyright policy: https://www.pib.gov.in/ContentPage.aspx?lang=1&menuid=794&reg=23
- arXiv RSS/Atom help: https://github.com/arXiv/arxiv-docs/blob/develop/source/help/rss.md
- Bluesky API reference: https://docs.bsky.app/docs/api/app-bsky-feed-get-feed
- Mastodon public timeline API: https://docs.joinmastodon.org/methods/timelines/
- YouTube Data API quota: https://developers.google.com/youtube/data/determine_quota_cost
- GNews pricing (excluded free tier): https://gnews.io/pricing
- NewsAPI pricing and terms (excluded free tier): https://newsapi.org/pricing and https://newsapi.org/terms
- NewsData.io pricing (delayed free tier): https://newsdata.io/pricing
- Reddit Data API terms (not assumed free for commercial use): https://redditinc.com/policies/data-api-terms
- TheSportsDB terms (free tier not assumed suitable for published apps): https://www.thesportsdb.com/docs_terms_of_use.php
- NVIDIA NIM / LLM API reference: https://docs.api.nvidia.com/nim/reference/llm-apis
- NVIDIA NIM getting started: https://docs.nvidia.com/nim/large-language-models/latest/getting-started.html
- Reddit Data API terms: https://redditinc.com/policies/data-api-terms
- Reddit developer access overview: https://support.reddithelp.com/hc/en-us/articles/14945211791892-Developer-Platform-Accessing-Reddit-Data
- YouTube Data API search: https://developers.google.com/youtube/v3/docs/search/list
- YouTube API quota: https://developers.google.com/youtube/data/determine_quota_cost
- Vercel Cron Jobs pricing/limits: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Neon serverless driver: https://neon.tech/docs/serverless/serverless-driver

---

## Final Build Directive

Build Daily Intelligence as a polished, trustworthy, genuinely usable news product—not a generic news dashboard mockup. Start with the complete design system and high-quality core screens, then wire up the database, authentication, source ingestion, story model, and settings. Make the AI layer explain stories from cited evidence and make trending notifications genuinely useful rather than noisy. Treat source access, commercial licensing, live-update cadence, and social-media display restrictions as first-class architecture constraints. The MVP must use the free-first source shortlist in Section 6 and must not add paid provider dependencies or development-only/delayed aggregator tiers as core ingestion sources. Keep the code modular, the UI premium, the experience accessible, and the current implementation runnable at every phase.
