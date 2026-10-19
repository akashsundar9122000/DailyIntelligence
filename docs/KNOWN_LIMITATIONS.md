# Known limitations

What the paper does not do, or does imperfectly, and why. Each is a choice or a
measured gap, not an oversight left unsaid.

## Coverage

- **Headlines and links, not articles, from most publishers.** Strict rights:
  a source is read only when its terms permit what we do. Indian and world
  publishers reach the paper through GDELT's index -- headline, site, time and
  link -- because their own feeds are licensed for personal use only. Official
  sources (PIB, NASA, the Federal Reserve) and arXiv are read in full where
  their terms allow.
- **Explainers from headlines are short.** The model reads what the page may
  show. From headlines alone it can say little, and the checks stop it saying
  more. The page says "article text was not read" when that is so.
- **arXiv dominates the story count on weekdays** (hundreds of preprints a day,
  each a story of its own). It publishes nothing at weekends.
- **GDELT tags a story with every country it mentions**, so a few world
  stories appear in the India edition.
- **Bluesky is not connected**: its developer guidelines require a public,
  regularly monitored contact email, which is the owner's to choose. The
  connector is built and tested. **YouTube** shows official channels' videos
  only, never counted or scored, as its API policies require.

## Accuracy

- **Clustering errs towards splitting**: one event can be two or four stories
  (seen: the Alberta base fire). The press room suggests duplicates by meaning;
  a person merges them.
- **The AI checks are blunt by design.** They catch a number, a name or a
  citation that is not in the records; they cannot catch a record's number used
  for the wrong thing, or a lower-case detail with no number. Editorial review
  (`EDITORIAL_REVIEW=1`) puts a person in front of the most consequential ones.
- **Search by meaning** uses a distance cut-off measured on one day's real
  headlines (0.70). A model change needs it measured again.

## Delivery

- **Push is tested against a stand-in push service**, which checks that each
  send is signed and encrypted, not that a phone displayed it. "Sent" means
  handed to the browser's push service.
- **iPhones receive web push only** from a site added to the home screen.
- **The scheduler is GitHub Actions**, which can start a run 5-20 minutes late
  under load. Freshness times on every page are real, so lateness is visible;
  Vercel's daily cron is the backstop for mail and the purge.

## Product

- **A preference changed in the moment before leaving the page can be lost**:
  preferences are saved shortly after a change, not on unload.
- **No cadence editor**: the catalogue sets each source's cadence on every
  tick, so an edit in the press room would silently revert. Cadence is a
  reviewed change in code.
- **English only.** The structure for Tamil and Hindi exists; machine
  translation, when it comes, will be labelled.
- **Load** was measured on one machine against a local database: 515 requests
  a second across five public pages at p95 71 ms, no errors. Production on
  Vercel Hobby has not been load-tested, deliberately: it would spend real
  function time and trip the rate limits it is there to measure around.
