# Native mobile apps: not yet

**Decision (19 October 2026):** no native iOS or Android app for now. The web
paper is built to be a good phone product, installable as a web app, and a
native app is reconsidered when one of the triggers below is met.

## What the web already does on a phone

- A phone layout designed for it, not a squeezed desktop: a five-item bottom
  bar, a navigation sheet, 44-pixel targets on touch screens, and the whole
  end-to-end suite run on a Pixel 7 profile at every deploy.
- Installable (`manifest.webmanifest`, icons), with push notifications through
  the standard Web Push protocol on Android and desktop browsers, and on iOS
  16.4 or later from the home screen.
- Light, dark and high-contrast editions, text size and reduced motion,
  applied before the first paint.

## Why not native now

- **Two more codebases for one reader experience.** Every rights rule, every
  check on AI output, every display rule lives in one place today. A native app
  would either duplicate them or depend on an API that does not exist yet.
- **The reason people usually build one -- notifications -- is covered** on
  Android and on iOS home-screen installs.
- **Store review and update cycles** would slow the one thing this paper must
  do quickly: withdraw a source or an explainer the moment it is wrong. On the
  web, that takes effect on the next request.

## What would change the decision

- iOS readers who will not add a home-screen app make up a large share of
  readers who ask for alerts.
- Offline reading of saved stories becomes a common request (a service worker
  could do much of it, but a cached edition must never pass for today's).
- A partner or distribution channel requires a store listing.

If one of these is met, the path is a thin native shell around the web paper
first (push, share sheet, widgets), not a rewrite.
