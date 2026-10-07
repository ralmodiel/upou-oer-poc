# UPOU OER — Open Educational Resources

A proof-of-concept, streaming-style web app for browsing and watching open educational videos from
[oer.upou.edu.ph](https://oer.upou.edu.ph/videos/) (UP Open University). Every video opens with a
**10-second promo reel generated from that video's data**, then plays the embedded YouTube video.

- React single-page app with no backend and no database. The video catalog is a static JSON file
  produced by a crawler script, and per-user state (My List, watch history, recent searches,
  privacy choices, theme, reel sound, the autoplay switch, dismissed tips) lives in `localStorage`.
- Responsive from 360px phones to 4K screens, keyboard accessible, light and dark themes, and
  respects `prefers-reduced-motion`. The visual direction is documented in
  [docs/design.md](docs/design.md).

## Proof of concept

This is a temporary, non-commercial proof of concept built to explore UPOU's open educational
videos. It is not a product or service and is expected to be taken down shortly after publication.

The interface uses conventions common to many video apps (a featured block, grids of thumbnails,
hover previews). It is not affiliated with, endorsed by, or intended to imitate or infringe the
design, trademarks, or trade dress of any commercial streaming service. See [NOTICE.md](NOTICE.md).

## Features

- **Browse (`/`)** — an editorial Featured block that moves on to the next pick after 7 seconds
  left alone (never under reduced motion or while scrolled away; a card under the pointer or in
  focus shows at once) and an "Also new" list, a "Recently viewed" strip, a row of collection
  chips, and one capped grid per collection (sections below the fold render lazily). Chips and rows follow each collection's newest video,
  newest first. With watch history off, a notice where Recently viewed sits turns it back on in
  one press. A dismissible "How it works" strip greets first-time visitors; the footer's "Help"
  link brings it back.
- **Collections (`/collections`, `/collections/:slug`)** — every category, largest first, with its
  cover, count and sample titles; each collection page sorts Newest / Oldest / A–Z and pages with
  "Load more".
- **Quick look (`?v=<id>` on any page)** — deep-linkable native `<dialog>` with the summary, tags,
  Play, Save, source links and "More like this".
- **Search (`/search?q=`)** — accent-insensitive search across titles, categories, tags, and
  descriptions, with per-collection filter chips and suggested topics.
- **My List** — save titles for later. It is stored in the browser and synced across tabs.
- **Watch (`/watch/:id`)** — the promo reel, then the player, inside the app shell with the
  title, meta, share link, topics and "Up next": a playlist that keeps its order from video to
  video, with "More…" for the next eight picks and its own scroll area.
- **Autoplay** — when a video ends, a "Next" card counts down 5 seconds (Play now, Cancel; Esc
  cancels), then plays the next Up next video. The Autoplay switch beside Up next is off by
  default; turning it on is remembered in this browser.
- **Theme** — light / dark / system toggle, stored under `upou:theme` and applied before the first
  paint without an inline script.
- **Keyboard and TV remotes** — Esc goes back everywhere (dialogs close first), `/` focuses
  search, `?` opens the shortcuts sheet, and the arrow keys move focus to the nearest control in
  that direction anywhere on the page (`src/lib/spatial.ts`), so the whole app works from a
  remote or a keyboard alone. On the player, Enter or ↓ reaches its Play / Pause key, so focus
  never has to enter the YouTube frame.
- **Previews** — hovering a card for a moment, or focusing it, plays that video's muted promo
  reel inside the card; it stops on leave, blur or Esc, and never starts under reduced motion.
  The featured viewer previews the video it shows when its card is focused.
- **Backdrops** — the featured block, quick look and watch page sit on a blurred still from the
  video, falling back to the thumbnail (and then to a plain surface) when an image is missing.
- **Brand colors** — UPOU maroon, forest and gold bands, rules and badges in both themes, and a
  color per collection, in catalog order, on its chip, collection card and page band
  (`src/components/tones.ts`).
- **Rotating thumbnails, friendly faces** — every page load shows another still of each video
  (the YouTube thumbnail or one of its three frames), and stills that catch a face not smiling
  are never shown in cards, hero slots or link previews while a clean image exists, nor ever in
  reels and previews; a video with no clean image shows its least bad one (see
  [Catalog data](#catalog-data)).
- **Topic chips** — tags tidied into topics: no people's names, titles or episode labels, merged
  spellings (COVID19 = COVID-19, FMDS = its full name) and fixed acronym case (`src/lib/tags.ts`).
- **Recommendations** — "Recommended for you" and "Because you watched …" on the home page and
  "Up next" on the watch page, from an in-browser engine (see [Recommendations](#recommendations)).
- **SEO** — a static, crawlable shell per video and collection, `sitemap.xml`, `robots.txt` and
  JSON-LD, generated at build time (see [SEO](#seo)).
- **Promo reels** — each reel is built in the browser from the video's title, category, tags,
  description, and three real still frames from the video. A seeded random generator (keyed by
  the YouTube ID) picks one of three templates (Cinematic, Split, Kinetic), an accent color, Ken
  Burns motion, transitions, and a synthesized Web Audio sting. Every video looks different, and
  each one replays the same way every time. Skip preview and a sound toggle are included.
- **Player** — privacy-enhanced `youtube-nocookie.com` embed that autoplays when the reel ends.
  Its end and play state arrive as the embed's own messages (no YouTube script), which drive
  autoplay and the Play / Pause key.

## Stack

| Area    | Choice                                                                           |
| ------- | -------------------------------------------------------------------------------- |
| Runtime | Node.js 24 LTS (see `.nvmrc`)                                                    |
| UI      | React 19, React Router 8 (data router, lazy watch route)                         |
| Build   | Vite 8, TypeScript 6.0 (strict)                                                  |
| Styling | Tailwind CSS 4 (CSS-first config in `src/index.css`)                             |
| Type    | Instrument Serif + Instrument Sans, self-hosted woff2 subsets (OFL)              |
| Quality | ESLint 10 (typescript-eslint, react-hooks), Prettier, Vitest 5 + Testing Library |

TypeScript stays on 6.0.x because typescript-eslint does not support TypeScript 7 (the native
compiler) yet.

## Getting started

```bash
fnm use            # or: nvm use — installs/uses Node 24 LTS from .nvmrc
npm install
npm run dev        # http://localhost:5280
```

`.npmrc` sets `engine-strict=true`, so installs fail fast on an unsupported Node version.

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server                              |
| `npm run build`     | Type-check, build, write SEO shells and sitemap   |
| `npm run seo`       | Re-run the SEO generator on an existing `dist/`   |
| `npm run preview`   | Serve the production build locally                |
| `npm run typecheck` | `tsc -b`                                          |
| `npm run lint`      | ESLint                                            |
| `npm test`          | Unit and component tests (Vitest)                 |
| `npm run format`    | Prettier                                          |
| `npm run audit`     | `npm audit` (fails on any vulnerability)          |
| `npm run verify`    | Typecheck, lint, format check, test, build, audit |

## Catalog data

`src/data/catalog.json` is a static snapshot of the UPOU OER library (2,124 videos, taken on
2026-10-03): a minified array of slim records (`CatalogRecord` in `src/types.ts`) holding the post
slug, YouTube id, title, category and publish date, plus description, tags, featured flag, channel
and image flags only when they carry information. It is about 835 KB of JSON (190 KB gzipped),
built into its own cacheable chunk. `src/data/expand.ts` derives the full `Video` (source,
thumbnail, backdrop and still-frame URLs) when the app starts; the image fields are worked out on
first read, so startup skips them for the videos a page never shows. `src/data/catalog.ts` serves
it synchronously: categories (`getCategories`, `getCategoryVideos`), home sections (`getRows`),
featured and latest picks, search and similar titles, all memoized. The people's names its tags
and titles teach (`src/lib/tags.ts`, which keeps them out of topic chips) are learned once by the
build and ship with the catalog chunk (`virtual:catalog-names` in `vite.config.ts`), so no page
learns them in the browser.

Images come from YouTube in sets: the original thumbnail plus the three still frames YouTube
generates, at 320 px for cards and at 1280 px (`maxres`) for backdrops and reels. Each page load
shows one member of the set per video (seeded by the id), so grids look different on every visit
while a video's thumbnail and backdrop always match. Three flags mark videos with fewer images:
`m: 0` means no 1280 px stills exist (the 640 px `sd` ones are used), `s: 0` means the `sd`
stills are missing too (only the 320 px `mq` images exist), and `q: 0` means YouTube has no stills
at all (only the thumbnail; the reel then plays on type or the thumbnail). `b` carries the source page's own
backdrop when it beats the YouTube default.

`src/data/frame-flags.json` holds one packed integer per YouTube id (bit layout in
`src/data/frameFlags.ts`): which candidates are unfit (a face not smiling, talking, eyes closed,
angry or awkward; a dark, blank or colour-cast still), the least bad one when all four are, stills
that repeat a shot, slide-like stills, the beautiful candidates and a best-first ranking. Local
scripts write it by scoring the public 320 px YouTube stills with MediaPipe's face landmarker
(blendshapes, head pose, sharpness) plus brightness, contrast and colour checks. Only these flags
are kept; no images or face data are committed. `src/data/images.ts` turns a record and its flags
into the image fields of a `Video`: `thumbnail` and `backdrop` (this load's pick among the clean
candidates, the beautiful ones when known), `poster` (the canonical image for hero slots, the
player, the reel's end card and link previews: the best clean candidate, else the least bad) and
`frames` (the reel's three shots: clean stills best first, each shot once). The SEO generator
uses the same module, so the static shells and the app show the same canonical images.

The snapshot was produced by a local crawler that:

1. Walks the paginated listing at `https://oer.upou.edu.ph/videos/`.
2. Reads each post page for the YouTube embed and metadata.
3. Confirms each video is public and embeddable through YouTube oEmbed.
4. Checks which YouTube thumbnails and still frames exist in maxres.

WordPress's default category ("Uncategorized", a quarter of the library) is labelled "General" and
kept out of the home sections. The crawler is a local tool and is not part of this repository
(`scripts/` is ignored by git). Replacement data must match `CatalogRecord`; malformed records are
skipped with a console warning, and the catalog test checks ids, dates and image hosts. Component
tests swap in fixtures with `setCatalog()` from `src/data/testing.ts`.

### Local tooling (not committed)

`scripts/` and `tmp/` are ignored by git, as is `.claude/` (Claude Code's local session state).
These tools only matter when the data is refreshed, and they rebuild every data file on this
machine with no other dependency (details, steps and timings in `scripts/README.md`). Setup once:
`py -m pip install -r scripts/faces/requirements.txt` and
`npm install --prefix scripts`.

| Command                                                  | What it does                                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `node scripts/pipeline.mjs`                              | Probes, face detection, frame analysis, then writes `src/data/frame-flags.json` (seconds when cached; ~10 min from an empty `tmp/`) |
| `node scripts/pipeline.mjs --crawl` (or `--from-json f`) | The same after a fresh crawl of the source site into `src/data/catalog.json`                                                        |
| `node scripts/pipeline.mjs --transcripts`                | Also turns `tmp/transcripts` into `src/data/recs.json` (see below)                                                                  |
| `node scripts/pipeline.mjs --check`                      | Lists the prerequisites found: Node 24.11+, Python and its packages, the face model, ffmpeg, Chrome                                 |
| `node scripts/render-reels.mjs --ids <id> [--mp4]`       | Renders a promo reel (`--variant preview` for the card preview) to `tmp/reels/<id>.webm`                                            |
| `node scripts/text/people-candidates.mjs`                | Lists tags that look like people's names, for `src/lib/people.ts`                                                                   |

After a new crawl, run the pipeline again so the flags match the catalog.

## Recommendations

"Up next" on the watch page and "Recommended for you" on the home page come from a small
content-based engine in `src/lib/recommend.ts`. It runs entirely in the browser: no server, no
tracking.

- **Index.** On first use the app builds a TF-IDF index over every video's text. `src/lib/text.ts`
  tokenizes titles (with bigrams), tags, category, channel and description, drops English and
  Filipino function words and stems English plurals, -ing and -ed. The build takes about a tenth
  of a second for 2,124 videos and is reused until the catalog changes; the home page builds it
  in ~8 ms slices while the browser is idle (`warmRecommenderAsync`). A query takes about 1 ms.
- **Up next** (`recommendFor(video, { profile, limit })`) ranks by cosine similarity, plus boosts for
  the same category, shared topic tags and the same series (titles with a common prefix such as
  "FASTLearn Episode 29 –" or "Chronic Heart Failure:"); publish date breaks ties. A profile reorders
  near-ties and demotes what was already watched, and at most four videos of another category
  appear in the first eight. A list shows one row per talk (speaker cuts, re-uploads and
  near-identical titles collapse), and a pick that could only be called "Related video" gives way
  to a later one with a real reason.
- **Recommended for you** (`recommendForProfile(profile)`) builds a taste vector from the watch
  history (half-life of seven days), the last ten searches and My List, skips what was already
  watched and spreads the result across categories and series; two of every eight places go to
  the best matches for the latest search. An empty profile gives an empty list, so the page can
  fall back to the latest videos.
- **Reasons.** `explainList(video, items, profile)` gives each card a short eyebrow such as "Same
  series", "Shares topics: Climate Change", "Also about PowerPoint" or "Because you watched
  “Food Safety”" (what follows a series name). Reasons never name a person or a generic word,
  never repeat the row's heading or name a topic beside its own acronym ("Asia-Europe Meeting",
  not "…, ASEM"), and none shows on three rows in a row or more than three times in eight rows
  (the next true reason, or a rewording, takes over).
- **Transcripts (optional).** Without transcripts the engine uses the metadata above. To add them,
  put caption files in `tmp/transcripts/` (yt-dlp names such as `<youtubeId>.en.vtt` work) and run
  `node scripts/text/ingest-transcripts.mjs && node scripts/text/build-recs.mjs`. The first writes
  plain text to `tmp/text/<youtubeId>.txt`; the second scores transcript + metadata with the same
  tokenizer and writes each covered video's top neighbors to `src/data/recs.json`, which the engine
  merges into its scores (the shipped file is an empty `{}`). `node scripts/text/make-id-list.mjs`
  writes the catalog's watch URLs to `tmp/ids.txt` for the caption download. `tmp/` and `scripts/`
  are not committed.
- **Stored in the browser.** Watch history (`upou:history`), committed searches (`upou:searches`),
  My List (`upou:my-list`) and the privacy choices (`upou:prefs`) live in `localStorage` on the
  device, at most the last 20 history entries and searches. Nothing leaves the device.

## Project structure

```
src/
  App.tsx                routes (the watch page is lazy-loaded)
  data/                  catalog.json (slim records), frame-flags.json, image sets (images.ts)
                         + catalog API (categories, rows, search)
  lib/                   localStorage hooks, theme, shortcuts, spatial (arrow-key) navigation,
                         recommender (recommend, text, history), SEO presets, seeded RNG, helpers
  layouts/ pages/        app shell (header, tab bar, footer, dialogs) and pages
  components/            featured block, sections, cards, quick-look dialog, ui/ primitives
  features/reel/         promo reel: plan (seeded), CSS timeline, Web Audio
  features/watch/        watch-page pieces: meta, share, topics, up next
  features/player/       YouTube player
tools/seo/               build step that writes the static shells, sitemap.xml and robots.txt
public/fonts/            self-hosted type; licenses in public/THIRD_PARTY_LICENSES.txt
```

## Security and privacy

- Production builds include a strict Content Security Policy (`vite.config.ts`). Scripts, styles
  and fonts load only from the app itself, images only from the app and YouTube/UPOU image hosts,
  and frames only from `youtube-nocookie.com`. The theme is applied from `main.tsx`, so the page
  needs no inline script.
- Videos use the privacy-enhanced `youtube-nocookie.com` embed. All crawled text is rendered as
  plain text, never as HTML. External links open with `rel="noopener noreferrer"`.
- The player listens only to messages whose origin is exactly `https://www.youtube-nocookie.com`
  and whose source is its own iframe, parses them defensively and reads nothing but the player
  state from them. It sends commands to that origin only, and only when the Play / Pause key is
  pressed; no message can make it send one.
- Values read back from `localStorage` are treated as untrusted (hand edits, older versions):
  readers check types and keep only well-formed items, so a bad value cannot break a page.
- Optional **Like on YouTube** button (absent unless `VITE_YT_CLIENT_ID` is set at build time). It
  contacts Google only when a viewer presses Like. Setup and UPOU adoption steps:
  [docs/youtube-like-setup.md](docs/youtube-like-setup.md).
- `npm audit` reports 0 vulnerabilities. Run `npm run audit` (also part of `npm run verify`) after
  dependency changes.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`:

1. In the repository settings, under **Pages**, set **Source** to **GitHub Actions**.
2. Push to `main` (or run the workflow manually). It runs `npm run verify` (typecheck, lint,
   format check, tests, build, audit) and publishes `dist/`.

How the build adapts to Pages:

- **Base path:** the workflow passes `BASE_PATH=/<repo>/`, which Vite uses for asset URLs and
  React Router uses as its `basename`. Local builds keep `/`.
- **Deep links:** `/collections/<slug>/`, `/watch/<id>/`, `/search/` and `/my-list/` are real
  files (see [SEO](#seo)), so loading them directly is a 200; Pages redirects `/search?q=x` to
  `/search/?q=x`, keeping the query. For anything else Pages has no rewrite rules, so the build
  also writes `404.html` as a copy of `index.html`; unknown paths boot the app, which then routes
  normally.
- **Security headers:** Pages cannot send custom headers, so the CSP ships as a `<meta>` tag. A
  `<meta>` CSP cannot set `frame-ancestors`; hosts that support headers should add one.

Any other static host works with `npm run build`; configure it to serve `index.html` for
unknown paths.

## SEO

The app renders in the browser, so the build also writes what crawlers and link previews need.
`tools/seo/generate.mjs` runs after `vite build` as part of `npm run build` (`npm run seo` re-runs
it on an existing `dist/`) and takes a few seconds:

- **Static shells.** `dist/index.html`, `dist/collections/index.html`, one
  `dist/collections/<slug>/index.html` per collection and one `dist/watch/<id>/index.html` per
  video (about 2,160 files, 16 MB). Each is the built `index.html` with that page's `<title>`,
  meta description, canonical URL, robots, Open Graph and Twitter tags, JSON-LD (`WebSite` with a
  `SearchAction`, `CollectionPage` + `ItemList`, `VideoObject`, `BreadcrumbList`) and a plain-HTML
  summary inside `#root` (title, facts, links to YouTube, the source page and the collection) that
  React replaces on mount. Link previews (`og:image`) never show a face the frame filter rejects
  when a clean image exists: a watch page previews the video's `poster`, a collection its newest
  video with a clean image, the home page the newest featured video with one. A video with no
  clean image at all previews its least bad one, as its card does. `VideoObject` lists only the
  stills the frame filter allows. `/search/` and `/my-list/` get `noindex` shells (no canonical,
  not in the sitemap) so that loading them directly is not a 404. `404.html` stays the plain app.
  Because the shells are directories, canonical URLs end with a slash (`/watch/<id>/`); Pages
  redirects `/watch/<id>` there.
- **`sitemap.xml`** with every indexable URL (`lastmod` from the publish date) and **`robots.txt`**
  (allow all, `Disallow` for `/search` and `/my-list`, `Sitemap:` line). `public/robots.txt` is
  the development default; the generator overwrites it.
- **At runtime** each page calls `useSeo()` from `src/lib/seo.ts`, which updates the same tags in
  place as you navigate (tags are reused by their `data-seo` attribute) and restores them on
  unmount. Search, My List and not-found pages are `noindex`. Titles stay within 65 characters
  and descriptions within 160; a video without a description gets "Title · Category · UP Open
  University · published Mon YYYY · Topics: …".

Absolute URLs come from `VITE_SITE_URL`, the site root including the base path (for example
`https://<user>.github.io/<repo>`). The deploy workflow sets it from the `configure-pages`
outputs (`origin` + `base_path`); set it yourself on other hosts. Without it, canonicals are
base-relative, no sitemap is written, and the app falls back to `window.location.origin` at
runtime. A project site on GitHub Pages lives under `/<repo>/`, where crawlers never read
`robots.txt`; submit `https://<user>.github.io/<repo>/sitemap.xml` in Search Console instead.

## License

- **Code:** [MIT](LICENSE).
- **Videos and metadata:** © UP Open University, published on
  [oer.upou.edu.ph](https://oer.upou.edu.ph/videos/) under CC BY 4.0 unless stated otherwise, and
  streamed via YouTube.
- **Bundled libraries:** MIT; see `public/THIRD_PARTY_LICENSES.txt`.

See [NOTICE.md](NOTICE.md) for the full notices, including the proof-of-concept and design
statements.

## Credits

Videos and descriptions © UP Open University, from
[oer.upou.edu.ph](https://oer.upou.edu.ph/videos/), streamed via YouTube. This project is an
independent proof of concept and is not affiliated with UPOU or any streaming service.
