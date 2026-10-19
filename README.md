# Daily Intelligence

*Know what matters. Understand why.*

A personalised news intelligence desk for India and the world, set as a
newspaper. It reads the world's news index (GDELT), official feeds and open
research every fifteen minutes, groups the coverage into stories, and shows how
fast each story is spreading and how well it is sourced as two separate
numbers. Every headline keeps its publisher, its publication time, the time we
found it, and a link to the original.

On top of that: explainers and morning and evening briefings written by an AI
model and shown only after every sentence is checked against the records it
cites; questions answered from a story's own sources; public conversation from
platforms whose terms allow it, embedded and linked; search by meaning; alerts
that never fire on heat alone; and a press room for the people who run it.

- **Specification:** `docs/BLUEPRINT.md`
- **Approved plan and decisions:** `docs/plan.md`
- **What is built and verified:** `IMPLEMENTATION_STATUS.md`
- **Every source and its rights decision:** `docs/SOURCE_RIGHTS.md`, `/sources`
- **How it fits together:** `docs/ARCHITECTURE.md`
- **When something goes wrong:** `docs/RUNBOOKS.md`
- **What it does not do, and why:** `docs/KNOWN_LIMITATIONS.md`
- **Why there is no native app yet:** `docs/MOBILE_DECISION.md`
- **Rules for working on it:** `CLAUDE.md`

## Running it

Node 24, pnpm 12, Postgres 17 locally with pgvector (`brew install pgvector`).

```sh
pnpm install
cp .env.example .env.local          # fill in the local database lines
createdb dailyintel_dev && createdb dailyintel_test
pnpm db:roles && pnpm db:migrate
pnpm dev                            # http://localhost:4610
```

Sign in at `/login` with any address: with no SMTP configured, the six-digit
code is recorded at `/dev/outbox` instead of being sent.

## The gate

```sh
pnpm check     # fast: secrets, tokens, layout, contrast, guards, provenance, types, lint, unit, components
pnpm verify    # everything: check + integration + build + end-to-end + budget
```

CI runs `pnpm verify` on every push. Screenshots: `pnpm build && node scripts/shoot.mjs / /login`.

## Environment

Every variable is optional and documented in `.env.example`; each absent value
has a defined behaviour. The ones a deployment needs:

| Variable | Why | Where it comes from |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_AUTH` | The runtime roles `di_app` and `di_auth` (Neon, pooled) | `pnpm db:roles:production` creates them with `APP_DB_PASSWORD` / `AUTH_DB_PASSWORD` |
| `APP_SECRET` | Signs sessions and hashes | `openssl rand -hex 32` |
| `CRON_SECRET` | Lets the schedulers call `/api/cron/*` | `openssl rand -hex 24`; also a GitHub Actions secret |
| `ADMIN_EMAILS` | Who may open the admin pages | Comma-separated addresses |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Sends sign-in codes | A Gmail app password, or any SMTP service |
| `NVIDIA_API_KEY` | Explainers, briefings, questions, search by meaning | build.nvidia.com |
| `AI_DAILY_LIMIT` | Ceiling on model outputs per IST day (default 300) | A number |
| `EDITORIAL_REVIEW` | `1` holds high-impact or thinly sourced explainers for an editor | `0` or `1` |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | Push notifications (VAPID) | `npx web-push generate-vapid-keys`; the subject is the site's https URL |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google" | Google Cloud console; redirect URI `<origin>/api/auth/callback/google` |
| `YOUTUBE_API_KEY` | Optional video source | Google Cloud console, YouTube Data API v3 |

## Production

The scheduler is `.github/workflows/tick.yml`: every fifteen minutes it calls
`/api/cron/tick` (sources), `/api/cron/enrich` (the AI pass) and
`/api/cron/notify` (alerts), each with its own time budget. Vercel's daily cron
calls `/api/cron/daily` (mail and the retention purge).

The database is migrated by hand before a deploy, from `.env.neon.local`
(never committed, never read by Next):

```sh
pnpm db:roles:production && pnpm db:migrate:production
```

Deploys follow a green CI run. With `DEPLOY_ENABLED=true` and the Vercel
secrets set in the repository, `.github/workflows/deploy.yml` deploys and then
runs the read-only production smoke suite. By hand, the same steps:

```sh
vercel deploy --prod --yes
SMOKE_BASE_URL=https://<production-url> SMOKE_EXPECTED_COMMIT=$(git rev-parse HEAD) pnpm test:smoke
```

## Licences

Headlines, excerpts and articles belong to their publishers. Each source's
terms were read before it was enabled, and are linked from `/sources`. That
review is engineering diligence, not legal advice.
