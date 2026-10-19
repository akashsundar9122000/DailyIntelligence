# Source rights

<!-- Generated from src/lib/sources/catalogue.ts by `pnpm docs:sources`. Do not edit by hand. -->

Every source Daily Intelligence has considered, what its terms say, and what we do as a result. A source is fetched only when it is **cleared**; anything unclear is **pending review** and never fetched; anything whose terms say no is **excluded**, listed publicly at `/sources` with the reason. Engineering diligence, not legal advice.

Publishers whose items are dropped from the GDELT index before storage: `thehindu.com`, `thehindubusinessline.com`, `indianexpress.com`, `timesofindia.indiatimes.com`, `economictimes.indiatimes.com`, `indiatimes.com`, `ndtv.com`, `bbc.co.uk`, `bbc.com`, `esa.int`.

## Cleared

Fetched on a schedule. Shown only as the flags allow.

### The GDELT Project (`gdelt-gkg`)

- **Kind:** World news index · provider `gdelt_gkg` · https://data.gdeltproject.org/gdeltv2/lastupdate.txt
- **Terms read:** 2026-10-18 — https://www.gdeltproject.org/about.html
- **Decision:** cleared. GDELT's own data is free for any use with a citation. It points to other publishers' articles, so we show only their headline, site, time and a link, never their text or images, and drop publishers whose terms forbid it.
- **May show:** headline yes · excerpt no · AI summary no · media no · commercial use yes
- **Attribution:** Data: The GDELT Project (gdeltproject.org)
- **Retention:** 30 days
- **Polled:** every 15 min
- **From the terms:** “all datasets released by the GDELT Project are available for unlimited and unrestricted use for any academic, commercial, or governmental use of any kind without fee. ... any use or redistribution of the data must include a citation to the GDELT Project and a link to this website”

### Press Information Bureau (`pib-english`)

- **Kind:** Official · India · provider `rss` · https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=3
- **Terms read:** 2026-10-18 — https://www.pib.gov.in/ContentPage.aspx?lang=1&menuid=794&reg=23
- **Decision:** cleared. The Government of India's press releases. PIB permits reproduction without prior approval, accurately and with prominent acknowledgement. Shown as official statements, never as independent reporting.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: Press Information Bureau, Government of India
- **Retention:** with the story, until the purge job
- **Polled:** every 15 min
- **From the terms:** “Material featured on this website may be reproduced free of charge and there is no need for any prior approval for using the content. The permission to reproduce this material shall not extend to any third-party material. ... the source must be prominently acknowledged.”

### arXiv cs.AI (`arxiv-cs-ai`)

- **Kind:** Research · preprints · provider `rss` · https://rss.arxiv.org/rss/cs.AI
- **Terms read:** 2026-10-18 — https://info.arxiv.org/help/api/tou.html
- **Decision:** cleared. Preprints in AI and machine learning. arXiv's metadata, abstracts included, is CC0. Labelled as preprints: not peer reviewed. We link to the abstract page and never store the paper.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: arXiv.org (not endorsed by arXiv)
- **Retention:** 90 days
- **Polled:** every 360 min
- **From the terms:** “You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration. ... Descriptive metadata ... includes fields such as title, abstract, authors, identifiers, and classification terms.”

### arXiv cs.CL (`arxiv-cs-cl`)

- **Kind:** Research · preprints · provider `rss` · https://rss.arxiv.org/rss/cs.CL
- **Terms read:** 2026-10-18 — https://info.arxiv.org/help/api/tou.html
- **Decision:** cleared. Preprints in AI and machine learning. arXiv's metadata, abstracts included, is CC0. Labelled as preprints: not peer reviewed. We link to the abstract page and never store the paper.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: arXiv.org (not endorsed by arXiv)
- **Retention:** 90 days
- **Polled:** every 360 min
- **From the terms:** “You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration. ... Descriptive metadata ... includes fields such as title, abstract, authors, identifiers, and classification terms.”

### arXiv cs.LG (`arxiv-cs-lg`)

- **Kind:** Research · preprints · provider `rss` · https://rss.arxiv.org/rss/cs.LG
- **Terms read:** 2026-10-18 — https://info.arxiv.org/help/api/tou.html
- **Decision:** cleared. Preprints in AI and machine learning. arXiv's metadata, abstracts included, is CC0. Labelled as preprints: not peer reviewed. We link to the abstract page and never store the paper.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: arXiv.org (not endorsed by arXiv)
- **Retention:** 90 days
- **Polled:** every 360 min
- **From the terms:** “You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration. ... Descriptive metadata ... includes fields such as title, abstract, authors, identifiers, and classification terms.”

### arXiv cs.CV (`arxiv-cs-cv`)

- **Kind:** Research · preprints · provider `rss` · https://rss.arxiv.org/rss/cs.CV
- **Terms read:** 2026-10-18 — https://info.arxiv.org/help/api/tou.html
- **Decision:** cleared. Preprints in AI and machine learning. arXiv's metadata, abstracts included, is CC0. Labelled as preprints: not peer reviewed. We link to the abstract page and never store the paper.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: arXiv.org (not endorsed by arXiv)
- **Retention:** 90 days
- **Polled:** every 360 min
- **From the terms:** “You are free to use descriptive metadata about arXiv e-prints under the terms of the Creative Commons Universal (CC0 1.0) Public Domain Declaration. ... Descriptive metadata ... includes fields such as title, abstract, authors, identifiers, and classification terms.”

### NASA (`nasa-news`)

- **Kind:** Official · United States · provider `rss` · https://www.nasa.gov/news-release/feed/
- **Terms read:** 2026-10-18 — https://www.nasa.gov/nasa-brand-center/images-and-media/
- **Decision:** cleared. NASA's news releases are generally not under US copyright, and may be used factually without implying endorsement, with NASA acknowledged.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: NASA
- **Retention:** with the story, until the purge job
- **Polled:** every 30 min
- **From the terms:** “NASA content ... generally are not subject to copyright in the United States. ... NASA content used in a factual manner that does not imply endorsement may be used without needing explicit permission. NASA should be acknowledged as the source of the material.”

### US Federal Reserve Board (`federal-reserve`)

- **Kind:** Official · United States · provider `rss` · https://www.federalreserve.gov/feeds/press_all.xml
- **Terms read:** 2026-10-18 — https://www.federalreserve.gov/disclaimer.htm
- **Decision:** cleared. Press releases from the US central bank. Public domain unless marked otherwise, to be cited as the source.
- **May show:** headline yes · excerpt yes · AI summary yes · media no · commercial use yes
- **Attribution:** Source: Board of Governors of the Federal Reserve System
- **Retention:** with the story, until the purge job
- **Polled:** every 30 min
- **From the terms:** “Unless otherwise indicated, information on Board's website is in the public domain and may be copied and distributed without permission. Please cite to the Board as the source of the information.”

### mastodon.social (`mastodon-social`)

- **Kind:** Social · provider `mastodon` · https://mastodon.social/api/v1/timelines/tag/
- **Terms read:** 2026-10-19 — https://mastodon.social/terms-of-service
- **Decision:** cleared. Public posts from accounts that opted into discovery, shown only through mastodon.social's own embed and linked to the original. We keep matching keywords, never the post's text; a deleted post is dropped at the next check, and nothing is kept past seven days. Posts are conversation about a story, never evidence for it.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** @user@mastodon.social, through mastodon.social's own embed, linked to the post
- **Retention:** 7 days
- **Polled:** every 15 min
- **From the terms:** “Whoever owns the Content retains ownership. ... When you upload Content to the Service, you are making it available via the Internet. Anyone, or any computer, might access your Content via RSS aggregators and readers, embed your Content in web pages and other media, or index and store your Content in search engines and databases.”

### YouTube (official channels) (`youtube-official`)

- **Kind:** Video · provider `youtube` · https://www.googleapis.com/youtube/v3/
- **Terms read:** 2026-10-19 — https://developers.google.com/youtube/terms/developer-policies
- **Decision:** cleared. Recent public, embeddable videos from a short list of official channels, through the YouTube Data API with this deployment's key, shown only in YouTube's own player and never altered. Kept seven days (the policies allow thirty), checked again before then. No statistics are kept, and videos are never counted, scored or turned into any measure: the policies forbid derived data and aggregation.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** YouTube, in YouTube's own player, with a link to the video and to YouTube's Terms of Service
- **Retention:** 7 days
- **Polled:** every 30 min
- **From the terms:** “After 30 calendar days, the API Client must either delete or refresh the stored data. ... You must not ... modify, build upon, or block any portion or functionality of a YouTube player ... make clear to the viewer that YouTube is the source of the relevant content ... Do not ... access or use API Data to create new or derived data or metrics.”

## Pending review

Not fetched until the question in each note is settled.

### Reserve Bank of India (`rbi-press`)

- **Kind:** Official · India · provider `rss` · https://www.rbi.org.in/pressreleases_rss.xml
- **Terms read:** 2026-10-18 — https://www.rbi.org.in/Scripts/Disclaimer.aspx
- **Decision:** pending_review. Waiting for permission: RBI's terms prohibit caching, and require permission before linking to any page other than its home page.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** Source: Reserve Bank of India
- **Retention:** with the story, until the purge job
- **Polled:** every 30 min
- **From the terms:** “Except as set forth below, caching and links to, and the framing of this Web Site or any of the contents are prohibited. ... For hyper-Linking to an internal page of this Web Site (not being the Home Page) the user must make a specific request for, and secure permission from RBI prior to hyper-linking”

### Securities and Exchange Board of India (`sebi`)

- **Kind:** Official · India · provider `rss` · https://www.sebi.gov.in/sebirss.xml
- **Terms read:** 2026-10-18 — https://www.sebi.gov.in/website-policy.html
- **Decision:** pending_review. Waiting for permission: SEBI allows its material to be reproduced after permission is requested by email. Linking needs none.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** Source: Securities and Exchange Board of India (SEBI)
- **Retention:** with the story, until the purge job
- **Polled:** every 30 min
- **From the terms:** “Material featured on this Website may be reproduced free of charge after taking proper permission by sending a mail to us. ... We do not object to you linking directly to the information that is hosted on this Website and no prior permission is required for the same.”

### World Health Organization (`who-news`)

- **Kind:** Official · International · provider `rss` · https://www.who.int/rss-feeds/news-english.xml
- **Terms read:** 2026-10-18 — https://www.who.int/about/policies/terms-of-use
- **Decision:** pending_review. Not yet: WHO's website terms allow extracts for research and private study, not for use alongside commercial purposes, without written authorisation.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** Source: World Health Organization
- **Retention:** with the story, until the purge job
- **Polled:** every 30 min
- **From the terms:** “Extracts of the information in the web site may be reviewed, reproduced or translated for research or private study but not for sale or for use in conjunction with commercial purposes.”

### Bluesky (`bluesky-public`)

- **Kind:** Social · provider `bluesky` · https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed
- **Terms read:** 2026-10-18 — https://bsky.social/about/support/tos
- **Decision:** pending_review. Not yet: Bluesky's developer guidelines require a public, regularly monitored contact email for any app that reads its network, and this deployment has not published one. The connector is built and tested; it switches on once that address is set. Posts would be shown only through Bluesky's own embed and linked.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** @handle on Bluesky, linked to the post
- **Retention:** 7 days
- **Polled:** every 15 min
- **From the terms:** “You retain ownership of your Content ... By sharing Content on Bluesky, you grant us a limited, worldwide, non-exclusive, royalty-free license”

## Excluded

Not fetched. Their terms do not allow a public news reader to show their content.

### The Hindu (`the-hindu`)

- **Kind:** Publisher · provider `rss` · https://www.thehindu.com/termsofuse/
- **Terms read:** 2026-10-18 — https://www.thehindu.com/termsofuse/
- **Decision:** excluded. Its terms prohibit displaying or using content for commercial or public purposes.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “Users are prohibited from ... displaying, publishing ... or using any Content available on or through the Site for commercial or public purposes.”

### The Indian Express (`indian-express`)

- **Kind:** Publisher · provider `rss` · https://indianexpress.com/rss/
- **Terms read:** 2026-10-18 — https://indianexpress.com/rss/
- **Decision:** excluded. Its RSS feeds are for personal and non-commercial use only, and titles are named as protected.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “Consumption of content via these RSS feeds are strictly for personal and non-commercial use.”

### The Times of India (`times-of-india`)

- **Kind:** Publisher · provider `rss` · https://timesofindia.indiatimes.com/rss.cms
- **Terms read:** 2026-10-18 — https://timesofindia.indiatimes.com/rss.cms
- **Decision:** excluded. Its terms forbid displaying or aggregating its feeds.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “TIL forbids you from any attempts at displaying, hosting, aggregating, reselling or putting to commercial use ... TIL's RSS feeds”

### NDTV (`ndtv`)

- **Kind:** Publisher · provider `rss` · https://www.ndtv.com/rss
- **Terms read:** 2026-10-18 — https://www.ndtv.com/rss
- **Decision:** excluded. Its RSS terms could not be read (the page refused our request), so it stays out until they can be.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “Terms page not reachable for review.”

### BBC News (`bbc-news`)

- **Kind:** Publisher · provider `rss` · https://www.bbc.co.uk/usingthebbc/terms/can-i-share-things-from-the-bbc/
- **Terms read:** 2026-10-18 — https://www.bbc.co.uk/usingthebbc/terms/can-i-share-things-from-the-bbc/
- **Decision:** excluded. Its terms require permission, and possibly a fee, for any business use.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “You'll need to get our permission first for any business use, and you might have to pay a fee.”

### European Space Agency (`esa`)

- **Kind:** Official · Europe · provider `rss` · https://www.esa.int/Services/Terms_and_conditions
- **Terms read:** 2026-10-18 — https://www.esa.int/Services/Terms_and_conditions
- **Decision:** excluded. Its terms prohibit redistributing or displaying its content without written authorisation.
- **May show:** headline no · excerpt no · AI summary no · media no · commercial use no
- **Attribution:** n/a
- **Retention:** with the story, until the purge job
- **Polled:** every 60 min
- **From the terms:** “ESA does not grant the right to resell or redistribute any information ... or to compile or create derivative works from material on its website.”
