# Runbooks

What to look at, in order, when something is wrong. Most answers are in the
press room (`/app/admin`, administrators only) before they are in any log.

## The paper has not updated

1. Press room, the line under the counts: when did the scheduler last tick?
   More than 45 minutes is a warning.
2. GitHub, Actions, **Tick**: is the workflow running? A failure there prints
   the status each endpoint answered. Missing `TICK_URL` or `CRON_SECRET`
   repository secrets fail loudly.
3. Press room, **Switches**: is "Reading sources" or a provider switched off?
4. Press room, **Needs attention**: which sources are failing or stale, and
   why. **Test read** reads a source now and stores nothing.
5. `curl https://<site>/api/health` must report `ok`, `di_app` and
   `rowSecurityEnforced: true`. Anything else is the database or the deploy.

GDELT's first run in a fresh database must find a file: if it fails with "No
knowledge-graph file in the last four hours", the stamps it tried are in the
message.

## A source should come off now

Press room, **Sources**, **Switch off**, with a reason. Its stories leave every
page on the next request (the display rule is applied where data is read). For
a rights decision that should outlast the database, also change its entry in
`src/lib/sources/catalogue.ts` and run `pnpm docs:sources`.

## An explainer is wrong

1. Press room, **Switches**, switch off **AI pass** if it is more than one.
2. Find the story; its explainer names the model and when it was written. The
   row is in `ai_briefings` with `prompt_version` and `source_item_ids`, so the
   exact records it was written from can be read back.
3. Set its status to `rejected` with a reason (`update ai_briefings set
   status = 'rejected', rejection = '...' where id = ...`, as the database
   owner). Readers stop seeing it on the next request.
4. If it passed the checks, the checks have a gap: add the case to
   `tests/unit/ai-validate.test.ts` and `tests/eval/explainer.eval.ts`, fix
   `validate.ts`, and run `pnpm eval:ai`.

To hold the most consequential explainers for a person, set
`EDITORIAL_REVIEW=1` in Vercel; they then wait in **Editorial review**.

## Notifications misbehave

Press room, **Switches**, **Notifications** pauses everything for everyone at
once. A reader asking why they did not get an alert can read the reason in
their own Settings, Notifications, Recent notifications.

## The AI bill or the model is a problem

`AI_DAILY_LIMIT` caps outputs per IST day. The press room's **The AI pass**
shows outputs by outcome and tokens for the last day. `NVIDIA_MODEL` replaces
the model list without a deploy of code.

## Two stories are one event

Press room, **Possible duplicate stories**, **Merge**. Readers' saves, feedback
and reading move to the kept story. The other direction -- a report in the
wrong story -- is **Not this story** on the report, on the story page.

## Database migration

Additive only: expand, deploy, then contract in a later change.

```sh
pnpm db:generate                 # after a schema change; access rules in a separate custom migration
pnpm db:migrate                  # development
pnpm db:migrate:production       # from .env.neon.local, before the deploy that needs it
```

Then read the change back (`\\d table`, `pg_policies`) rather than trusting the
command's output.

## Deploy

CI must be green on the commit. From a clean clone of `main`:

```sh
vercel deploy --prod --yes
SMOKE_BASE_URL=https://daily-intelligence-gold.vercel.app SMOKE_EXPECTED_COMMIT=<sha> pnpm test:smoke
```

Then trigger the Tick workflow by hand and read `ingestion_runs` and `job_runs`
for the new rows.

## Secrets were exposed

Rotate first, investigate second: Neon role passwords (`ALTER ROLE ... PASSWORD`,
then the Vercel variables), `APP_SECRET` (signs every session: rotating it signs
everyone out), `CRON_SECRET` (Vercel and the GitHub secret together), the NVIDIA
key, the SMTP app password, the VAPID pair (every push subscription must then be
renewed by its reader).
