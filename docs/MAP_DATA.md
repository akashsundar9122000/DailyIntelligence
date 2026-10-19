# Map data

Story maps (`src/components/news/place-map.tsx`) are drawn from
**Natural Earth admin-0 countries, India point of view**
(`ne_10m_admin_0_countries_ind`), simplified by `pnpm geo`
(`scripts/geo/build.mts`) into `src/lib/media/geo/countries.ts`, which is
committed. The build never fetches.

- **Licence.** Read 2026-10-19 at naturalearthdata.com/about/terms-of-use:
  "All versions of Natural Earth raster + vector map data found on this website
  are in the public domain. … No permission is needed to use Natural Earth.
  Crediting the authors is unnecessary." Every map is credited anyway
  ("Map: Natural Earth").
- **Why the India-view set.** A news product for India draws India's borders as
  India depicts them. The default Natural Earth set draws them de facto.
- **Indian states are pins, not outlines** (`src/lib/media/geo/states.ts`).
  India's state boundaries are the Survey of India's; a line from any other
  dataset risks disagreeing with them, and a point inside the state does not
  draw one.
- **When a story gets a map** (`src/lib/media/story-image.ts`): it names an
  Indian state, or exactly one country outside India. GDELT lists every country
  an article mentions, so with several the first is not reliably where it
  happened; such a story gets its section's cover art instead.
