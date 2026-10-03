# UPOU OER — Open Educational Resources

A proof-of-concept, streaming-style web app for browsing and watching open educational videos from
[oer.upou.edu.ph](https://oer.upou.edu.ph/videos/) (UP Open University). Every video opens with a
**10-second promo reel generated from that video's data**, then plays the embedded YouTube video.

- React single-page app with no backend and no database. The video catalog is a static JSON file
  produced by a crawler script, and per-user state (My List, watch history, theme, reel sound,
  dismissed tips) lives in `localStorage`.
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

- **Browse (`/`)** — an editorial Featured block with manual prev/next and an "Also new" list, a
  "Continue watching" strip, a row of collection chips, and one capped grid per collection
  (sections below the fold render lazily). A dismissible "How it works" strip greets first-time
  visitors; the footer's "Help" link brings it back.
- **Collections (`/collections`, `/collections/:slug`)** — every category with its cover, count
  and sample titles; each collection page sorts Newest / Oldest / A–Z and pages with "Load more".
- **Quick look (`?v=<id>` on any page)** — deep-linkable native `<dialog>` with the summary, tags,
  Play, Save, source links and "More like this".
- **Search (`/search?q=`)** — accent-insensitive search across titles, categories, tags, and
  descriptions, with per-collection filter chips and suggested topics.
- **My List** — save titles for later. It is stored in the browser and synced across tabs.
- **Watch (`/watch/:id`)** — the promo reel, then the player, inside the app shell with the
  title, meta, share link, topics and an "Up next" list.
- **Theme** — light / dark / system toggle, stored under `upou:theme` and applied before the first
  paint without an inline script.
- **Keyboard** — Esc goes back everywhere (dialogs close first), `/` focuses search, `?` opens the
  shortcuts sheet, and the arrow keys move within grids and chip rows.
- **Promo reels** — each reel is built in the browser from the video's title, category, tags,
  description, and three real still frames from the video. A seeded random generator (keyed by
  the YouTube ID) picks one of three templates (Cinematic, Split, Kinetic), an accent color, Ken
  Burns motion, transitions, and a synthesized Web Audio sting. Every video looks different, and
  each one replays the same way every time. Skip Intro and a sound toggle are included.
- **Player** — privacy-enhanced `youtube-nocookie.com` embed that autoplays when the reel ends.

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
thumbnail, backdrop and still-frame URLs) when the app starts (a few milliseconds), and
`src/data/catalog.ts` serves it synchronously: categories (`getCategories`, `getCategoryVideos`),
home sections (`getRows`), featured and latest picks, search and similar titles, all memoized.

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

## Recommendations

"Up next" on the watch page and "Recommended for you" on the home page come from a small
content-based engine in `src/lib/recommend.ts`. It runs entirely in the browser: no server, no
tracking.

- **Index.** On first use the app builds a TF-IDF index over every video's text. `src/lib/text.ts`
  tokenizes titles (with bigrams), tags, category, channel and description, drops English and
  Filipino function words and stems English plurals, -ing and -ed. The build takes tens of
  milliseconds for 2,124 videos and is reused until the catalog changes; a query takes about 1 ms.
- **Up next** (`recommendFor(video, { profile, limit })`) ranks by cosine similarity, plus boosts for
  the same category, shared topic tags and the same series (titles with a common prefix such as
  "FASTLearn Episode 29 –" or "Chronic Heart Failure:"); publish date breaks ties. A profile reorders
  near-ties and demotes what was already watched, and at most four videos of another category
  appear in the first eight.
- **Recommended for you** (`recommendForProfile(profile)`) builds a taste vector from the watch
  history (half-life of seven days), the last ten searches and My List, skips what was already
  watched and spreads the result across categories and series. An empty profile gives an empty
  list, so the page can fall back to the latest videos.
- **Reasons.** `explain(video, candidate, profile)` returns a short eyebrow such as "Same series",
  "Shares topics: Climate Change", "Also about PowerPoint" or "Because you watched “…”".
- **Transcripts (optional).** Without transcripts the engine uses the metadata above. To add them,
  put caption files in `tmp/transcripts/` (yt-dlp names such as `<youtubeId>.en.vtt` work) and run
  `node scripts/text/ingest-transcripts.mjs && node scripts/text/build-recs.mjs`. The first writes
  plain text to `tmp/text/<youtubeId>.txt`; the second scores transcript + metadata with the same
  tokenizer and writes each covered video's top neighbors to `src/data/recs.json`, which the engine
  merges into its scores (the shipped file is an empty `{}`). `node scripts/text/make-id-list.mjs`
  writes the catalog's watch URLs to `tmp/ids.txt` for the caption download. `tmp/` and `scripts/`
  are not committed.
- **Stored in the browser.** Watch history (`upou:history`), committed searches (`upou:searches`)
  and My List (`upou:my-list`) live in `localStorage` on the device, at most the last 20 history
  entries and searches. Nothing leaves the device.

## Project structure

```
src/
  App.tsx                routes (the watch page is lazy-loaded)
  data/                  catalog.json (slim records) + catalog API (categories, rows, search)
  lib/                   localStorage hooks, theme, keyboard shortcuts, seeded RNG, YouTube + format helpers
  layouts/ pages/        app shell (header, tab bar, footer, dialogs) and pages
  components/            featured block, sections, cards, quick-look dialog, ui/ primitives
  features/reel/         promo reel: plan (seeded), CSS timeline, Web Audio
  features/watch/        watch-page pieces: meta, share, topics, up next
  features/player/       YouTube player
public/fonts/            self-hosted type; licenses in public/THIRD_PARTY_LICENSES.txt
```

## Security and privacy

- Production builds include a strict Content Security Policy (`vite.config.ts`). Scripts, styles
  and fonts load only from the app itself, images only from the app and YouTube/UPOU image hosts,
  and frames only from `youtube-nocookie.com`. The theme is applied from `main.tsx`, so the page
  needs no inline script.
- Videos use the privacy-enhanced `youtube-nocookie.com` embed. All crawled text is rendered as
  plain text, never as HTML. External links open with `rel="noopener noreferrer"`.
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
- **Deep links:** `/collections/<slug>/` and `/watch/<id>/` are real files (see [SEO](#seo)). For
  anything else Pages has no rewrite rules, so the build also writes `404.html` as a copy of
  `index.html`; unknown paths boot the app, which then routes normally.
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
  React replaces on mount. `404.html` stays the plain app. Because the shells are directories,
  canonical URLs end with a slash (`/watch/<id>/`); Pages redirects `/watch/<id>` there.
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
