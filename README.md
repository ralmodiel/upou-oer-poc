# UPOU Networks

A proof-of-concept, streaming-style web app for browsing and watching open educational videos from
[UPOU Networks](https://oer.upou.edu.ph/videos/) (UP Open University). Every video opens with a
**10-second promo reel generated from that video's data**, then plays the embedded YouTube video.

- React single-page app with no backend and no database. The video catalog is a static JSON file
  produced by a crawler script, and per-user state (My List, watch history, reel sound) lives in
  `localStorage`.
- Responsive from 360px phones to 4K screens, keyboard accessible, and respects
  `prefers-reduced-motion`.

## Proof of concept

This is a temporary, non-commercial proof of concept built to explore UPOU's open educational
videos. It is not a product or service and is expected to be taken down shortly after publication.

The interface uses conventions common to many video apps (a featured block, grids of thumbnails,
hover previews). It is not affiliated with, endorsed by, or intended to imitate or infringe the
design, trademarks, or trade dress of any commercial streaming service. See [NOTICE.md](NOTICE.md).

## Features

- **Browse** — rotating hero billboard, category rows with scroll buttons, hover quick actions
  (Play, My List, More Info), "New on UPOU Networks", "Recently Watched", and
  "Because you watched…" rows.
- **Details modal** — deep-linkable (`/?v=<id>`), with tags, links to the source, and
  "More Like This".
- **Search** — accent-insensitive search across titles, categories, tags, and descriptions.
- **My List** — save titles for later. It is stored in the browser and synced across tabs.
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
| Quality | ESLint 10 (typescript-eslint, react-hooks), Prettier, Vitest 5 + Testing Library |

TypeScript stays on 6.0.x because typescript-eslint does not support TypeScript 7 (the native
compiler) yet.

## Getting started

```bash
fnm use            # or: nvm use — installs/uses Node 24 LTS from .nvmrc
npm install
npm run dev        # http://localhost:5173
```

`.npmrc` sets `engine-strict=true`, so installs fail fast on an unsupported Node version.

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Start the dev server                              |
| `npm run build`     | Type-check and build to `dist/`                   |
| `npm run preview`   | Serve the production build locally                |
| `npm run typecheck` | `tsc -b`                                          |
| `npm run lint`      | ESLint                                            |
| `npm test`          | Unit and component tests (Vitest)                 |
| `npm run format`    | Prettier                                          |
| `npm run audit`     | `npm audit` (fails on any vulnerability)          |
| `npm run verify`    | Typecheck, lint, test, build, and audit in one go |

## Catalog data

`src/data/catalog.json` is a static snapshot of the UPOU Networks library (2,124 videos, taken on
2026-10-03): a minified array of slim records (`CatalogRecord` in `src/types.ts`) holding the post
slug, YouTube id, title, category and publish date, plus description, tags, featured flag, channel
and image flags only when they carry information. `src/data/expand.ts` derives the full `Video`
(source, thumbnail, backdrop and still-frame URLs) when the app starts, and `src/data/catalog.ts`
serves it synchronously: categories (`getCategories`, `getCategoryVideos`), home sections
(`getRows`), featured and latest picks, search and similar titles, all memoized.

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

## Project structure

```
src/
  App.tsx                routes (watch page is lazy-loaded)
  data/                  catalog.json (slim records) + catalog API (categories, rows, search)
  lib/                   localStorage hooks, seeded RNG, YouTube + format helpers
  layouts/ pages/        app shell and pages
  components/            header, hero, rows, cards, details modal, …
  features/reel/         promo reel: plan (seeded), CSS timeline, Web Audio
  features/player/       YouTube player
```

## Security and privacy

- Production builds include a strict Content Security Policy (`vite.config.ts`). Scripts load
  only from the app itself, images only from the app and YouTube/UPOU image hosts, and frames only
  from YouTube.
- Videos use the privacy-enhanced `youtube-nocookie.com` embed. All crawled text is rendered as
  plain text, never as HTML.
- `npm audit` reports 0 vulnerabilities. Run `npm run audit` (also part of `npm run verify`) after
  dependency changes.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`:

1. In the repository settings, under **Pages**, set **Source** to **GitHub Actions**.
2. Push to `main` (or run the workflow manually). It runs `npm run verify` (typecheck, lint,
   tests, build, audit) and publishes `dist/`.

How the build adapts to Pages:

- **Base path:** the workflow passes `BASE_PATH=/<repo>/`, which Vite uses for asset URLs and
  React Router uses as its `basename`. Local builds keep `/`.
- **Deep links:** Pages has no rewrite rules, so the build also writes `404.html` as a copy of
  `index.html`. Unknown paths such as `/watch/<id>` boot the app, which then routes normally.
- **Security headers:** Pages cannot send custom headers, so the CSP ships as a `<meta>` tag. A
  `<meta>` CSP cannot set `frame-ancestors`; hosts that support headers should add one.

Any other static host works with `npm run build`; configure it to serve `index.html` for
unknown paths.

## License

- **Code:** [MIT](LICENSE).
- **Videos and metadata:** © UP Open University, published on
  [UPOU Networks](https://oer.upou.edu.ph/videos/) under CC BY 4.0 unless stated otherwise, and
  streamed via YouTube.
- **Bundled libraries:** MIT; see `public/THIRD_PARTY_LICENSES.txt`.

See [NOTICE.md](NOTICE.md) for the full notices, including the proof-of-concept and design
statements.

## Credits

Videos and descriptions © UP Open University, from
[UPOU Networks](https://oer.upou.edu.ph/videos/), streamed via YouTube. This project is an
independent proof of concept and is not affiliated with UPOU or any streaming service.
