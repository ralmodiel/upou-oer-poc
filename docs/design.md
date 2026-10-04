# UPOU OER — design direction (v2)

A distinctive identity for an open-university video library: **editorial, warm, academic,
modern**. It must not read as a streaming-service clone. Specifically avoid: black + red
cinematic palettes, a full-bleed auto-playing billboard, hover-zoom poster rows as the main
browsing pattern, and a full-screen black player stage.

The 10-second generated promo reel stays. It is the product's signature feature.

## Identity

- **Wordmark:** text only, never the logo artwork (this project is not affiliated with UPOU).
  "UPOU" in charcoal and "OER" in maroon, echoing the logo's two-tone lettering, set in
  the display serif, with the descriptor "Open Educational Resources". A small "Proof of concept" pill sits
  next to it on every page (title "Proof of concept").
- **Colors come from the UPOU logos** (measured from the UPOU OER mark and the UP seal):
  Networks maroon `#8d0c34` (gradient edge `#7f001f`), charcoal `#373637`, amber card
  `#f5a71d`, green card `#036a4d`; seal forest `#00563f`, maroon `#8d1436`, gold `#fcb51b`.
  Tokens (CSS variables in `src/index.css`, exposed to Tailwind through `@theme`):

| Token                   | Light                 | Dark               | Use                                    |
| ----------------------- | --------------------- | ------------------ | -------------------------------------- |
| `--color-paper`         | `#faf8f6`             | `#1a191a`          | page background                        |
| `--color-surface`       | `#ffffff`             | `#242325`          | cards, header, dialogs                 |
| `--color-surface-2`     | `#f2eeeb`             | `#2f2e30`          | chips, wells, skeletons                |
| `--color-ink`           | `#373637`             | `#f4f1ef`          | primary text (logo charcoal)           |
| `--color-ink-2`         | `#5c5a5c`             | `#c9c5c7`          | secondary text                         |
| `--color-ink-3`         | `#6b686a`             | `#9b9699`          | tertiary text, placeholders (AA)       |
| `--color-line`          | `#e6e1dd`             | `#3a383b`          | 1px borders                            |
| `--color-maroon`        | `#8d0c34`             | `#fcc75a`          | brand text and links (gold in dark)    |
| `--color-maroon-2`      | `#7f001f`             | `#ffd98a`          | link hover                             |
| `--color-maroon-soft`   | `#f4e9e4`             | `#3f1a2a`          | tinted backgrounds (cream in light)    |
| `--color-forest`        | `#00563f`             | `#5fc59c`          | category eyebrows, "open/free" accents |
| `--color-forest-soft`   | `#e2efe9`             | `#173328`          | tinted backgrounds                     |
| `--color-amber`         | `#f5a71d`             | `#f7b545`          | highlights, "New" marker (ink text on) |
| `--color-gold`          | `#fcb51b`             | `#fcc75a`          | featured marker only                   |
| `--color-overlay`       | `rgb(55 54 55 / 0.6)` | `rgb(0 0 0 / 0.7)` | dialog backdrop                        |
| `--color-on-accent`     | `#ffffff`             | `#1a191a`          | text on maroon / forest fills          |
| `--color-charcoal`      | `#373637`             | `#373637`          | text on amber / gold (both themes)     |
| `--color-action`        | `#7b1113`             | `#6e0f26`          | filled buttons, active chips, badges   |
| `--color-action-2`      | `#640d0f`             | `#86172f`          | hover on those fills                   |
| `--color-on-action`     | `#ffffff`             | `#faf8f6`          | text on action fills                   |
| `--color-focus`         | `#8d0c34`             | `#fcc75a`          | keyboard focus ring                    |
| `--color-mark-maroon`   | `#7b1113`             | `#c23a5f`          | chip dots, collection bars (maroon)    |
| `--color-mark-forest`   | `#014421`             | `#2f8f68`          | chip dots, collection bars (forest)    |
| `--color-mark-charcoal` | `#373637`             | `#9b9699`          | chip dots, collection bars (charcoal)  |

Round 3 (QA3-A) token decisions: **actions** fill with UP maroon, the band colour, in both themes
(the deep band maroon with paper text in dark), so `--color-maroon` is free to be brand _text_;
in dark it is gold (`#fcc75a`), so every maroon link, rule or active label reads gold on dark
surfaces while maroon stays in fills and bands. **Focus** is its own token: maroon in light, gold
in dark; the global ring is 2px with a 2px offset, cards draw a 3px outline on the article, and
`band-focus` swaps the ring to gold on maroon, forest and charcoal bands. **Marks** (chip dots, the
top bar of a collection card) use the band colours, lifted in dark so a 10px dot stays visible on
dark paper (gold uses `--color-band-gold`). Light `maroon-soft` is cream (`#f4e9e4`): the old pink
tint read as pink beside the photos.

Contrast-driven adjustments (checked with a WCAG script): light `ink-3` darkened one step so it
clears 4.5:1 on `surface-2`; dark `maroon` lightened so it clears 4.5:1 on `surface-2` and
`maroon-soft`; `on-accent` and `charcoal` added because white fails on the dark-theme maroon and
forest, and light ink fails on amber. Layout variables that live beside the tokens:
`--gutter`, `--header-h` (3.5rem, 4rem at `md`) and `--tabbar-h` (3.75rem below `md`, 0 above).
Tailwind also gets `rounded-card`, `rounded-pill`, `shadow-lift`, `ease-out-soft`,
`font-display`, `text-title` (page-title scale) and an `eyebrow` utility; `dark:` follows
`data-theme`, not the OS.

Light is the default. Dark follows `prefers-color-scheme` and a manual choice (`light` /
`dark` / `system`) stored in `localStorage` under `upou:theme`; the `<html>` element carries
`data-theme="light|dark"`. A tiny inline-free bootstrap (in `main.tsx`, before render)
applies the stored theme to avoid a flash. Verify AA contrast for every text token on
`paper` and `surface` in both themes with a script before finishing. **One theme stop:** the
header has a single icon button that flips light ↔ dark, so the first press always changes
something and the remote meets one stop; all three choices (Light, Dark, System) sit in the Help
menu's Theme group.

- **Type:** display serif for headings and the wordmark, humanist sans for UI and body. Both
  self-hosted from `public/fonts/` (OFL-licensed, latin subset, `font-display: swap`, total
  ≤ 150 KB woff2, licenses appended to `public/THIRD_PARTY_LICENSES.txt` under `== Fonts ==`).
  Suggested pair: **Instrument Serif** (display) + **Instrument Sans** (UI). Tokens:
  `--font-display`, `--font-sans`. Scale: `text-sm` meta, `text-base` body, `text-lg` card
  titles are sans semibold; page titles `clamp(1.75rem, 1.2rem + 2vw, 3rem)` serif.
- **Shape and depth:** radius `--radius-card: 14px`, `--radius-pill: 999px`; 1px `--color-line`
  borders; shadows only on hover/focus (`0 10px 30px -12px rgb(27 26 23 / 0.25)`); hover lift
  ≤ 2px; no scale above 1.02. Images always 16:9 with `object-cover`, rounded, with a subtle
  inner ring (`ring-1 ring-black/5`).
- **Motion:** 150–250 ms, `--ease-out-soft: cubic-bezier(0.2, 0.8, 0.2, 1)`; transform and
  opacity only; everything respects `prefers-reduced-motion`. Nothing auto-plays on the home
  page.

## Layout and pages

Routes: `/`, `/collections`, `/collections/:slug`, `/search?q=`, `/my-list`, `/watch/:id`, plus
`?v=<id>` for the quick-look dialog on any page. **The watch page lives inside the app shell**
(header and footer visible), not a full-screen stage.

- **Header:** paper background with a bottom `--color-line`; translucent + blur once scrolled.
  Left: wordmark + "Proof of concept" pill. Center/right (desktop): nav Browse · Collections · My List (count
  badge), an always-visible search field (≥ md), theme toggle. Mobile (< md): wordmark, search
  icon that expands to a full-width field, menu with the nav + theme toggle. Fits 360px.
- **Home (`/`):**
  1. **Featured** editorial block: at `lg` a 7/5 grid — large 16:9 image card (featured video)
     with its text _beside/below_ the image (eyebrow category · serif title · summary · Play and
     Quick look buttons), and a right column "Also new" list of 4 items (small thumb, title,
     category). Manual prev/next controls only, no auto-rotation.
  2. **Recently viewed** row (only when history exists): compact cards in a row that scrolls
     sideways (see "Round 5: row carousels"), no hover scaling.
  3. **Collections** chip row: every category with its count, the one with the newest video first,
     linking to `/collections/:slug`; "All collections" link.
  4. **Sections:** the collections with the newest videos only, newest first (see "Round 4: a
     shorter home"), each a heading + "See all (n)" link and a row of cards that scrolls sideways
     (round 5), then an "All 30 collections" button. Collection, search and My List pages keep
     grids. Below-the-fold sections render lazily (`content-visibility: auto` plus a sensible
     `contain-intrinsic-size`).
- **Card:** thumbnail (16:9, rounded, lazy, `srcSet` 320w/1280w with accurate `sizes`), then
  eyebrow (category, forest, small caps), title (sans semibold, 2-line clamp), meta (date ·
  "New" marker for the 10 newest). **Clicking the card plays** (`/watch/:id`). Secondary
  actions above the stretched link: bookmark (My List, `aria-pressed`) and info (Quick look),
  both visible on touch devices and on hover/focus-within on pointer devices. Hover: 2px lift +
  shadow + a small play glyph on the thumbnail. Keyboard: card link, then the two buttons.
- **Collections (`/collections`):** largest first (the home orders collections by their newest
  video instead); from md, a grid of category cards (a mosaic of the newest stills, name, count,
  2–3 sample titles); on phones a compact list (see round 4).
  **Category (`/collections/:slug`):** title, count, sort control
  (Newest / Oldest / A–Z), full grid with "Load more" in pages of 24.
- **Search:** results grid with a category filter chip row and a result count; empty state with
  suggested topics; no results → suggestions.
- **My List:** grid in saved order, with an empty state linking to Collections (round 7: plus
  the newest videos to start from, see below).
- **Quick look dialog (`?v=`):** native `<dialog>`, centered card at ≥ md (image left 5/12,
  6/12 from lg, text right), full-screen sheet on mobile; title, meta, summary, tags, Play, My
  List, source links, and 6 "More like this" compact cards. Deep-linkable; history behavior as today.
- **Watch (`/watch/:id`):** two-column at `lg` (main 8/12, aside 4/12). Main: the **player
  stage** (16:9, rounded, surface background) where the promo reel plays and then the YouTube
  embed takes over; below it the serif title, meta row (category link · date · "Watch on
  YouTube" · "View on oer.upou.edu.ph" · Share/copy link · My List), summary/description, tag
  chips. Aside: "Up next", a playlist with More… and an Autoplay switch (see round 5), and a
  "Back to {category}" link. On mobile the stage is edge-to-edge and the aside follows the text.
- **Promo reel restyle:** keep the 10 s timeline, the three templates, seeded variety, Skip and
  sound controls. Replace the crimson/black ident with the new identity (paper or ink ident
  with the serif wordmark, maroon/forest/gold accents from the token set); legible type over
  stills; the reel fills the 16:9 stage, not the viewport.
- **Footer:** three columns on desktop: About (the proof-of-concept disclaimer, verbatim from
  `NOTICE.md`'s first paragraph), Source (UPOU OER, YouTube channel, CC BY 4.0 note),
  Project (MIT license, third-party licenses link, "View source" if a repo URL is configured).
- **States:** skeletons use `--color-surface-2`; friendly empty and error states with one clear
  action; a styled 404 for unknown routes (instead of redirecting home).

## Accessibility and quality bar

WCAG AA contrast in both themes (verify `--color-ink-2`/`-3` on paper and surface); 2px maroon
focus ring with offset; skip link; landmarks and heading order; icon buttons labelled; dialogs
trap focus; all interactions keyboard-operable; touch targets ≥ 40px; no horizontal overflow at
360px; LCP image gets `fetchPriority="high"`, everything else lazy; CLS ≈ 0. Each watch page's
static shell preloads the very file its player poster (and the reel's first frame) shows, so the
phone LCP image starts with the HTML (360×780: median 352 vs 456 ms at CPU 1x, 1232 vs 1520 ms at
4x).

## Keyboard

- **Esc is Back everywhere** (user requirement). A single app-shell handler: if a dialog is open
  the dialog closes (native behavior); else if focus is in a text field, Esc clears/blurs that
  field (the search box keeps its own behavior); else `navigate(-1)` when there is in-app
  history, otherwise `navigate('/')`. Ignore events whose default was already prevented.
- **Watch page focus:** never move focus into the YouTube iframe automatically; focus the
  player stage container (`tabIndex={-1}`) instead, so Esc keeps working after the reel. When
  the user has clicked into the video (focus is inside the iframe) and the pointer leaves the
  stage, return focus to the stage container so Esc works again. Keep a visible Back button as
  well. Keyboards and remotes play and pause through the stage's own Play / Pause key (round 5),
  so focus never has to enter the iframe.
- Tab order follows the visual order; `/` focuses the search field; the My List toggle and
  Quick look are reachable from every card.

## Non-goals

No backend, no database, no analytics, no accounts. No third-party UI, animation or icon
libraries; icons are inline SVG. No Netflix names, logos or sound marks anywhere.

## Discoverability (user requirement)

This is a heavy redesign, not a reskin: structure, navigation and components change, and every
feature must be easy to find without instructions.

- **Label the primary actions.** Buttons show text + icon ("Play", "Save", "Details"), not icons
  alone; card quick actions reveal their labels on hover/focus and on touch devices.
- **Persistent, obvious navigation:** Browse · Collections · My List · Search are always visible
  (bottom tab bar on phones, top nav on larger screens), with the current section highlighted.
- **A short "How it works" strip** on the home page for first-time visitors (dismissible,
  remembered in `localStorage`): three cards — "Video opens with a 10-second preview reel
  (press Skip to jump in)", "Save titles to My List", "Browse by collection or search
  everything". Shown again from a "Help" link in the footer.
- **Teach through empty states:** My List and Search explain what they do and
  offer one clear next step.
- **Keyboard help:** a `?` key opens a small shortcuts sheet (Esc = Back, / = Search, Space/K in
  the player belong to YouTube); the watch page shows "Esc to go back" once, subtly.
- **Breadcrumbs** on collection and watch pages (Browse › Collection › Title); clear page titles.
- **Self-describing reel controls:** Skip and Sound buttons have visible text; the reel's
  progress bar is visible; the "Starting in 3 · 2 · 1" countdown says what happens next.
- **Consistent affordances:** every card behaves the same everywhere (click plays, bookmark saves,
  info opens Quick look); links look like links; hover and focus states always visible.

## Round 2 addendum

Round 2 adds four features and a crawlable build without changing the identity above; the
colour rule stands (UPOU maroon, forest, paper and ink; never a black-and-red streaming look).

- **TV-remote navigation** (`src/lib/spatial.ts`): one window `keydown` handler moves focus to
  the nearest focusable element in the arrow's direction, measured from the whole card for card
  links so grids move card by card. Open dialogs scope the search to their contents; `inert`,
  `aria-hidden`, hidden and disabled elements never receive focus; text fields keep ← / → until
  the caret reaches the edge. A target is scrolled into view (centred for cards, with reduced
  motion honoured). The focus ring is the only indicator, so it must stay visible on every stop.
- **Previews** (`src/components/preview.tsx`): hovering a card for 800 ms, or focusing it, mounts
  the muted promo reel inside the card's 16:9 box; one preview plays at a time, Esc stops it
  before the shell treats Esc as Back, and reduced motion disables automatic previews. The end
  card holds for a second, then the thumbnail returns until the pointer leaves.
- **Backdrops** (`Backdrop`, `WatchBackdrop`): a blurred, dimmed still behind the featured
  block, the quick look and the watch page. Decorative (`aria-hidden`, empty `alt`), absolutely
  positioned so it never shifts layout, and faded in on load; a missing still falls back to the
  thumbnail and then to the plain surface.
- **Recommendations** (`src/lib/recommend.ts`, `text.ts`, `history.ts`): a TF-IDF index built in
  the browser on first use (idle time on the home page), blended with category, tag and series
  signals and a local taste profile (watch history, searches, My List). Home shows "Recommended
  for you" and "Because you watched …" with a one-line reason per card; the watch page's "Up
  next" uses the same engine. Nothing leaves the device.
- **SEO** (`src/lib/seo.ts`, `tools/seo`): one head preset per page type, applied at runtime by
  `useSeo()` and baked into a static shell per route at build time (title, description,
  canonical with a trailing slash, Open Graph, Twitter, JSON-LD, a plain-HTML summary that React
  replaces), plus `sitemap.xml` and `robots.txt`. Search, My List and not-found pages are
  `noindex`. Shells and the running app describe a page identically: og:image is the video's
  `poster` (round 5; it was the YouTube thumbnail even when flagged), a collection previews its
  newest video with a clean image, and JSON-LD `thumbnailUrl` lists only stills the frame filter
  allows.
- **Image sets**: cards and backdrops rotate among the YouTube thumbnail and its three stills per
  page load (seeded by the id); `m: 0` and `s: 0` in the catalog mark videos without 1280 px or
  640 px stills, which fall back to the next size down.

## Brand color usage (round 3, user direction)

Use more of the UP and UPOU colors in the page chrome, never as a tint over imagery or video.

- **Palette roles:** maroon (`--color-maroon`, logo #8d0c34; UP maroon #7b1113 for deep bands) is the
  primary brand surface and action color; forest (`--color-forest`, seal #00563f; UP forest #014421
  for deep bands) is the secondary surface and "open/free" color; gold/amber (`--color-gold`,
  `--color-amber`) are highlights (rules, badges, active indicators, hover underlines); charcoal
  (`--color-ink` in light) anchors text.
- **Where color goes (surfaces, not overlays):**
  - A thin tri-color brand stripe (maroon · gold · forest, 3–4px) along the top of the header.
  - The home intro band ("Open Educational Resources from the University of the Philippines Open
    University") on a solid maroon or forest band with paper text and a gold rule.
  - Section headings with a short gold rule and brand-colored eyebrows; tinted section bands
    (forest-soft, maroon-soft) every third section for rhythm (round 4).
  - Each collection gets a deterministic brand color (maroon, forest, gold, charcoal) used for its
    chip dot, the top bar of its collection card and the solid band of its category page header.
  - Footer on a deep maroon (or forest) band with paper text and gold link hovers.
  - Active nav/tab indicators in gold on maroon or maroon on paper; "New" badges in gold with
    charcoal text; secondary buttons in forest outline.
- **Never:** colored scrims, duotones, multiply/overlay blends or tinted gradients over thumbnails,
  backdrops, previews or the reel's footage. Images keep their natural colour (round 5: the
  collection header strip dropped its grayscale, dimming and paper scrim, since no text covers
  it); only a light local gradient may sit behind text. Brand color may frame an image (a border,
  a corner tab, a band beside it) but must not sit on top of it.
- **Contrast:** paper text on maroon/forest bands, charcoal text on gold/amber; check AA in both
  themes (dark theme uses the lighter dark-mode brand tokens for text and the deep values for bands).

### Both themes (user direction)

Brand color must be just as present in dark mode as in light mode; dark mode is not a gray version
of the page. Add band tokens (surfaces that carry paper/charcoal text) to `src/index.css` next to
the existing tokens:

| Token                   | Light     | Dark      | Text on it            |
| ----------------------- | --------- | --------- | --------------------- |
| `--color-band-maroon`   | `#7b1113` | `#6e0f26` | `#faf8f6`             |
| `--color-band-forest`   | `#014421` | `#0f4a35` | `#faf8f6`             |
| `--color-band-gold`     | `#fcb51b` | `#e3a91a` | `#1a191a` / `#373637` |
| `--color-band-charcoal` | `#373637` | `#373637` | `#faf8f6`             |

- The header stripe, intro band, footer band, collection bands and section rules use these in both
  themes; soft section backgrounds use `maroon-soft` / `forest-soft` (already themed; mixed 70%
  toward paper in dark on the home page).
- Dark mode keeps gold as the accent for rules, active states and badges; brand-colored text on dark
  surfaces uses the lighter dark tokens (`--color-maroon` is gold `#fcc75a`, `--color-forest`
  `#5fc59c`).
- Verify AA for every band/text pair in both themes with a script, and compare light and dark
  screenshots of the same pages side by side: each brand element must be visible in both.

## Round 3 addendum: reels and stills

- **Frame filter (strict; when in doubt, flag):** a candidate still is flagged at build time
  (`src/data/frame-flags.json`) when a face is not clearly smiling; mid-word (jaw dropped, or lips
  parted without a clear smile) or mid-chew; with the mouth wide open, even in a laugh; stern,
  angry or sad (knit brows, a frown, a sneer, pressed or bitten lips, raised inner brows);
  mid-blink, half-shut or squinting; lopsided, forced or grimacing; turned (yaw > 18°), tipped
  down (> 7°) or up (> 10°) or tilted (> 15°); looking away, or down at notes, a laptop or a phone;
  hands raised above the shoulders or held at the face (MediaPipe Pose); near the frame's edge;
  blurred; or unreadable (a head the landmarker misses but YuNet finds;
  drawn faces excepted). Misses seen on contact sheets go to `scripts/faces/overrides.json` with a
  reason. Flagged stills are never used in the thumbnail rotation, the reel or the canonical slots
  (hero, quick look, poster), where the first clean still stands in. When every candidate is
  flagged, the video's own picture (card, list row, poster) is its least bad one (never dark or
  blank); reels and previews never use a flagged frame, and a video without a clean still has no
  reel or preview. Slides, title cards and smiling, frontal, sharp faces are the preferred picks.
- **Repeated stills:** three cuts play only between three different stills; with fewer (repeats,
  or near-twins from a static lecture camera) the reel plays one long slow move on the first still.
- **No usable image:** when every image is flagged or missing (`q: 0` videos have no YouTube stills
  at all, only the thumbnail), the watch page skips the reel and the player starts at once over
  the video's least bad image on a light stage (round 5; it used to be kinetic type on a night
  frame).
- **Low-res stills, title cards and slides:** superseded by "Reels" under "Round 5: watch page,
  home notices, reels" below (no framed inset on a forest or paper stage, no forced split).
- **Previews:** the card's own image dissolves to footage within ~0.5 s (1.1 s preview lead) and
  the footage stays in colour; card-size previews are picture only (see round 5).
- **Hand-off:** the reel's end card and the player poster share `video.poster` (the best clean
  candidate, else the least bad), so the cut to the player is seamless.
- **Topic chips and reasons** (`src/lib/tags.ts`): never a person's name (titled, credited in a
  title, or unmistakably a name), a title fragment, an instalment label ("FASTLearn Episode 62")
  or a catalogue tag ("Conference E-Proceedings"); acronyms keep their spelling (CHED, ASEAN,
  COVID-19) and small words stay lowercase. Recommendation reasons never repeat the row heading,
  appear at most three times in eight rows, and quote what follows a series name.

## Round 4 addendum: remote, a shorter home, privacy

### Remote markers (`data-spatial`, `src/lib/spatial.ts`)

The arrow keys move focus to the nearest control in that direction; a few markers shape the walk:

- `group`: a wrapped or scrolling row of chips is one stop for ↑ / ↓ (entered at its roving tab
  stop, else the active or first chip); ← / → walk its items.
- `heading`: a "See all" link beside a section heading. ↑ / ↓ from outside the section pass over
  it to the section's content; ↑ from inside the section reaches it.
- `aside`: a secondary bar control (theme, Help) reached along its bar, never by ↑ / ↓ from the
  page.
- `entry`: the hero's Play; ↓ from the header lands there while it is near the top of the screen.
- `wide`: a centred control (Load more, "All 30 collections") stands for its parent's full-width
  row, so ↓ from any column of a grid reaches it before the footer.
- `skip`: never a target (the skip link, Tab only).
- `track` (round 5): a row of cards that scrolls sideways. ← / → walk all its cards, those out of
  view included; from outside it only the cards in its view (between its scroll paddings) count.
  A card only partly in view is revealed by scrolling the track to the position that shows it
  whole (not `nearest`, which mandatory snapping would undo).
- `over-entry` (round 5): controls that sit above the hero (the featured Previous / Next); ↓ from
  them lands on the hero's Play instead of skipping the block.
- `list` (round 5): a scrolling list (Up next); ↑ / ↓ walk its items, clipped ones included.

Inside a card, moves use the card's shown boxes (clipped by line clamps). ↓ from a card's link leaves
the card in one press (its own Save / Details only when nothing lies below); an ↑ straight after
returns to that card's Save, and any other move forgets it (round 7).

Open dialogs scope the walk to their contents, and a sticky dialog header counts as a bar. In
settings panels the switches and their buttons share one column, so ↑ / ↓ visit them in order.

### Round 4: a shorter home

- **Cap:** from md, the 12 collections with the newest videos, newest first (General excluded;
  was the 12 largest until the user asked for recency), one row of cards each: three
  at md, four from lg. Phones keep 7 sections of four cards (two rows of two). After them, a
  centred "All 30 collections" button (`wide`) under "18 more collections, plus everything in
  these." The chips row above still links to every collection.
- **Personal rows:** "Recommended for you" keeps two rows (eight from lg, six at md, four on
  phones); "Because you watched" gets one row, like the collections.
- **Measured** at 1440×900, from the top to the footer by ↓ alone: a fresh visit was 22.7 screens
  and 99 presses, and is now 8.3 screens and 28 presses. With a watch and search history it was
  25.1 screens and 108 presses, and is now 10.3 screens and 35 presses. Images fetched after
  scrolling the whole page: 7.2 MB, now 1.7 MB.
- **Lazy sections:** a collection section shows a skeleton of the same geometry until it is
  within two screens (IntersectionObserver), with `content-visibility: auto` and
  `contain-intrinsic-size` per breakpoint (35rem on phones, 25rem from md, 29rem from 80rem). Back
  and reload render every section at once, so the restored scroll position lands on the same
  layout. Personal rows are computed after first paint and frozen for the visit (saving a card
  does not reshuffle them), but a privacy change that alters what they may use recomputes them at
  once and never shows the old picks meanwhile.
- **Band rhythm:** every third section is a tinted band, forest-soft then maroon-soft, with paper
  between and a hairline where two paper sections meet. In dark mode the tints are mixed 70%
  toward paper, so a long page stays calm. Brand presence stays in the header stripe, the intro
  band, collection colours and the footer.

### Collections page

- **Phones (below md):** one card holding a compact list: the collection's brand bar, a 16:9 cover
  80px wide, the name (up to two lines), the count and a chevron; 64px rows, the whole row is the
  link. 360px went from 15.8 screens of mosaic cards to 4.3.
- **From md:** the mosaic cards. The first row loads its stills at once; the others load within a
  quarter screen of the viewport (IntersectionObserver), which cut the first load at 1440 @2x from
  662 KB to 338 KB.
- Covers and the category header strip use only videos with a usable image (below).

### Videos without a usable image

Superseded in round 5: such videos now show their least bad image (see "Round 5: watch page, home
notices, reels"). The round 4 rule was:

When the frame filter flags every image candidate of a video (`imagesOf()` returns null; 239
videos in frame data v2), cards and hero slots show a **title tile**: the title on the
collection's band at every size, two lines when narrow, in the display serif under a short gold
rule (charcoal maps to maroon, which never reads as a dark box among stills). No single-letter or
monogram tiles. It never falls back to the flagged thumbnail or poster, and never shows a blank
or dark box. Collection covers and the
category header strip skip such videos. Card previews start only for videos with at least one
unflagged still: without one, the reel would play its type on the dark stage. Featured opens on
a slide with an image; a title-tile slide stays one press away.

### Privacy and history panel (`PrivacyDialog`)

- **Openers:** Help menu ("Privacy and history"), the footer link, "Manage history" on Recently
  viewed and "Privacy settings" under the personal rows.
- **Dialog:** a native modal with a sticky title and Close (phones scroll the panel inside
  100dvh), and Done at the end. Each opening starts at the top. Esc, Backspace, Done and the
  backdrop close it, and focus returns to the opener; when the opener went with its row (history
  turned off under "Manage history"), focus moves to the nearest control where it was.
- **Switches:** `role="switch"` buttons named by their label and described by their text. Off is an
  outlined track with a grey knob, on is a forest track with a light knob (3:1 or better in both
  themes). A switch that needs watch history shows off with "Needs …" and stays focusable
  (`aria-disabled`), so the remote and screen readers still reach it; its stored choice returns
  with history.
- **Storage:** `upou:prefs` holds `history`, `useHistory`, `recommendations`, `recentlyViewed`,
  `becauseYouWatched` and `searches` (all on by default); `upou:history` and `upou:searches` keep
  the last 20 each. Turning "Save watch history" or "Save searches" off deletes what was saved and
  stops recording (the watch page records nothing). "Use watch history for suggestions" off hides
  Recently viewed and Because you watched, and Recommended, Up next and More like this ignore
  history. Every change applies at once, persists across reloads and follows in other tabs
  (storage events).
- **Clear rows:** "3 videos in your history" with Clear history, "1 search saved" with Clear
  searches, in the switches' column. At zero the button stays focusable and is marked
  unavailable, so focus never drops.

## Round 5: watch page, home notices, reels

### Up next and autoplay (`UpNext`, `useUpNext`, `AutoplayNext`)

- **Playlist:** a click (or Enter) on an Up next row keeps the list: the next page shows the same
  videos in the same order, with that row marked "Now playing" in place. The list travels with the
  history entry, so Back, Forward and reload keep each list.
- **More…** under the list adds the next eight picks without reordering and focuses the first new
  row. The list scrolls inside its own area: about 5.5 rows on phones, the player column's height
  from lg. More… works out the next picks only when needed: on a click, when autoplay reaches the
  end of the list, or on idle after hover or focus.
- **Remote:** `data-spatial="list"` walks every row, clipped ones included, before More…; ↓ from
  the stage goes to the Now playing row. A row chosen by keyboard or remote keeps focus on the next
  page, as its Now playing row, where the list sits beside the player; under it (narrow screens)
  the stage takes focus, as after a click.
- **Autoplay:** when a video ends, a light "Next" card counts down 5 s with Play now and Cancel
  (Cancel takes focus; Esc cancels instead of going Back), then plays the next row and keeps the
  playlist; at the end of the list it adds the next picks first. The "Autoplay" switch in the Up
  next header is on by default and kept in this browser (`upou:autoplay`; only a stored `false` is
  off). Off, the video just ends.
- **Play / Pause key:** a keyboard-only button on the stage, shown while focused and reached with
  Enter or ↓ from the stage. It drives the video through the embed's commands, so focus never
  enters the iframe and Esc, Backspace and the arrows keep working. It follows the player: Play
  while paused, Pause while playing or buffering.
- **Player messages:** the end and the play state come from the embed's widget messages
  (`enablejsapi=1`), so there is no YouTube script and the CSP is unchanged. Only messages from
  `https://www.youtube-nocookie.com` and from this player's own frame count, and they are parsed
  defensively; commands go to that origin only, on a press of the Play / Pause key.
- **Layout:** from lg the watch page holds the viewport height, so Up next filling in never pulls
  the footer into view (CLS 0 at 1024, 1440 and 1920).

### Home

- **History off:** when watch history is off, or kept out of suggestions, the home says so where
  Recently viewed sits ("Watch history is off, so Recently viewed and Because you watched are
  hidden"), with one press to "Turn on watch history" (or "Turn on suggestions") and a link to the
  privacy settings. After turning it on, it confirms until the first video lands. It is a div, not
  a section, so the band rhythm stays put.
- **Featured previews:** the featured viewer plays the shown video's preview on keyboard focus
  anywhere in it and on each previous / next pick, not only under a hovering pointer. As on cards,
  videos without usable stills stay still and reduced motion turns previews off.
- **Order:** home rows and collection chips follow each collection's newest video, newest first
  (the static home shell too), so the rows are the most recently updated collections. The
  Collections page keeps largest first.
- **Back:** from the player, Back (and Esc / Backspace) steps over the videos watched in a row to
  the page the first one was opened from (`src/lib/trail.ts`). That page then returns to the exact
  card that was opened (`useReturnFocus`: its row, item and control, not a lookup by video id, so
  never the Recently viewed copy), with the row's sideways scroll and the card's place on screen
  kept even when new rows (Recently viewed, Because you watched) land above it. Search → Esc does
  the same. While focus is in the header, html drops its scroll padding, so the search field and
  remote ↑ into the header never scroll the page.

### Reels

- **Picture and band:** the picture fills the top of the stage in its own colours with nothing on
  it (no scrim, tint, box or type), and all type (ident, kicker, title, hook, end-card copy) and
  the Skip / Unmute controls sit in a frosted light band below it: 30% of the stage height on
  wide stages, 36% at 560px and below, 48% on watch-stage phones. Type never covers a face or a
  slide's own text. Photos crop around their upper middle and keep their slow move.
- **Slides and title cards** show whole in a 16:9 box as tall as the picture, over a blurred copy
  of themselves (a 30% veil), in any template; 640px stills crop only their letterbox bars.
- **Card previews** (stages 480px and narrower) are picture only, full height, with no band or
  type: the card's own title sits right below. The featured viewer keeps the band.
- **End card:** the poster fills the stage exactly as the player poster does, with "Now playing",
  the title, facts and the 3·2·1 count in the band; the copy fades at 9.5 s, so the cut to the
  player moves nothing and no white card ever shows. The featured viewer returns to its poster.
- **Templates:** slides no longer force the split template (about a third each of split,
  cinematic and kinetic); the split ident's block is gold, never a dark bar.
- **One still:** a seeded slow push-in about a point in the upper middle that drifts to one side.
  It opens on the full frame, so the card image or loading cover it follows hands over without a
  jump. Card previews move more, about what the still must keep in view (its faces; a slide's or
  title card's text, from frame-flags bits 25-41): a push-in to 1.18-1.26 on photos with a lateral
  drift, 1.10 on slides and cards with none, always keeping that box and the frame's edges covered.
  No box (or text across the whole frame): the reel's own move. Reduced motion stays static.
- **Baked-in bars:** stills with black bars on every side are zoomed just enough to push the bars
  out of the 16:9 slot (`frame-crops.json`), on cards, the player poster and every reel image,
  cutting at most 2% of the picture; pillarbox-only, letterbox-only and larger cuts stay as they
  are.
- **Best faces first:** the ranking favours a smiling, professional-looking speaker: a genuine
  smile with the mouth closed or lightly parted, open eyes toward the camera, a frontal and sharp
  face, a moderate share of the frame near the middle, even light. Open mouths, glances away,
  blur, harsh or dim light and awkward crops rank down.
- **Natural colour:** stills keep their own colours, with no grayscale, dimming, vignette or grain
  over imagery and only light, local gradients behind type. The end card and the player poster
  are undimmed.
- **Light palette in both themes:** reels pin the light tokens (ident, paper, end card) whatever
  the theme. Dark-mode reels measured a mean luma of 25–52, which breaks the no-dark-frames rule.
- **No clean still:** the reel is skipped and the player starts at once over the video's least
  bad image on a light stage, never a dark box.

### Videos with no clean image

When the frame filter flags every image of a video, cards, Up next rows, mosaics, the phone
collections list and the player stage show its least bad image (the data's `poster`, never dark,
blank or colour-cast) instead of a plain colour title tile; the tile is only a last resort when
an image fails to load. Reels and previews still never use a flagged frame, and covers keep to
clean images. Link previews follow the same rule: `og:image` is the video's `poster`, a
collection's preview its newest video with a clean image.

### Direct loads

`/search/` and `/my-list/` have static shells too (`noindex`, outside the sitemap), so loading them
directly is a 200 instead of Pages' 404 fallback. Pages answers `/search?q=…` with a 301 to
`/search/?q=…`, query kept; the router and the header's search field accept both forms.

## Round 5: row carousels (user request)

"Add left and right buttons to the list of videos in the landing page", to sample more of a
collection. Only the behaviour comes from streaming sites; the look stays this site's own.

- **Rows** (`Carousel`, `carousel-state.ts`, `.row` in `browse.css`): every home row is one line of
  cards that scrolls sideways and snaps to cards, at the old grid sizes: two cards to a page on
  phones, three at md, four from lg. Only collections with 12 or more videos get a row, so the
  Next button always has at least two more pages after the first (the 12 newest-first such
  collections). A row holds 12 to 16 of its newest videos (titles shown above left out, topped back
  up to 12 from them when needed); a "See all n videos" tile under the collection's colour bar ends
  it only when the collection holds more than the row shows.
  "Recommended for you" is now one row of 12 picks; "Because you watched" (12) and Recently viewed
  (its smaller cards) are rows too, behind the same privacy switches. Phones show all 12
  collection rows: one line each is about as long as seven rows of two by two.
- **Buttons:** round 44px buttons on the surface colour with the lift shadow, a hairline border and
  an ink chevron, centred on the card images in the gutter. Each press moves on by every card in
  view (smooth unless reduced motion). Previous hides at the start and Next at the end; a focused
  button that hides hands focus to the first card of the new page. Pointer devices show them while
  the row is hovered or holds focus, with decorative page dots beside the heading. No dark paddles,
  scrims or tints over images.
- **Touch:** no buttons. Native swipe with snapping; cards are 2rem narrower so the next one peeks.
- **Remote and keyboard:** the buttons are `skip` and the track is `track`. ← / → walk the cards to
  the See all tile while the track keeps the whole focused card in view (a card's reveal scrolls
  its article, not its title link). ↑ / ↓ land on the nearest card in view, and ← / → never jump
  into another row's hidden cards. Paging while focus is elsewhere moves the row's Tab stop to its
  first card in view.
- **Edges and previews:** the track runs into the gutter (up to 4rem) with matching scroll padding,
  so focus rings, lifts and previews are never cut off and cards line up with the heading; a clip
  keeps only 12px of gutter beside the view, so cards paged past leave no sliver or title fragment.
  Previews play inside the track and stop once their card leaves the view. The hover play glyph
  is a small round badge in the thumbnail's bottom-left corner, off the speaker's face.
- **Performance:** a row renders its first page and the peeking card at once, the rest when used
  (hover, focus, touch; round 7: no longer on idle), and measures itself on the frame after layout. Images stay lazy;
  using or scrolling a row loads the next page's images ahead. Phone sections are estimated at
  23.5rem. Measured before → after at 1440×900: 8.2 → 8.3 screens, 28 → 28 ↓ presses (with
  history 10.3 → 9.9, 35 → 32); at 360×780 8.5 → 9.1 screens, 24 → 24 presses for 12 rows instead
  of 7 (with history 11.0 → 10.8, 38 → 31). Images after a full scroll at 1440 @2x 1.99 → 2.21 MB
  (each row's peeking card); TBT at 4× CPU at parity (median 425 → 399 ms); CLS 0. The DOM after a
  full scroll grows from about 1,700 to 4,500 elements (round 7, render on use only: about 1,970,
  64 cards).

## Round 7: home and browse polish

Refinement only: same tokens, type and identity.

- **Cards:** every card on the home (rows, Recently viewed, Also new) shares one treatment: 14px
  radius (10px for the small Also new stills), a hairline ring (`ring-black/5`, `white/10` in dark,
  so dark stills keep an edge on dark paper), a 2px lift with shadow on hover, a 0.99 press, the
  round play badge, and on keyboard focus the 3px outline with a 1.02 scale. Without an eyebrow
  line (collection rows) the title sits 12px under the image, as the eyebrow does, so the focus
  ring stays clear of it.
- **How it works chip:** the home intro band carries a "How it works" chip (paper outline on the
  band, right from md, under the text on phones). It re-shows the strip if dismissed, scrolls to
  it and focuses its heading; the strip arrives with a gold inset outline that fades (motion-safe).
- **Quiet row buttons:** from 80rem on fine pointers, where they sit wholly in the gutter, Previous
  / Next stay in view at rest as a transparent outline with an ink-3 chevron, and come in full
  while the row is hovered or holds focus. Narrower, they stay hidden until then (they would cover
  card edges). Page dots count the whole row before its rest renders.
- **My List empty state:** the empty state goes compact and "Start with the newest" follows under a
  hairline: the newest videos with a clean poster, one line of cards at every width (2, 3, 4, 5
  with the page grid's columns, `.starter-picks` in browse.css). The picks stay for the visit, so
  a Save pressed there keeps its place and focus while the list fills in above (48px above the
  hairline, 64px from 40rem when the list is above it). Unsaving a card on My List moves focus to
  the Save of the card that takes its place (the one before at the end; the empty state's first
  link when none is left), never to the page body.
- **Bars in stills:** the home backdrop, the mosaic strip and collection covers take the still's
  bar zoom (`zoomStyle`), like cards; on the blurred backdrop it sits on a wrapper so the drift's
  own scale adds to it.
- **Measured** (4× CPU, 1440×900, 4 runs, YouTube images blocked, before → after in the same
  session): load TBT median 892 → 571 ms, scroll TBT 274 → 216 ms, INP median 528 → 416 ms, DOM
  after a full scroll 4,592 → 1,973 elements (196 → 64 cards). AA: chip text 10.3:1 (light) /
  11.3:1 (dark) on the band, its outline 3.1 / 3.3:1; quiet chevron at least 4.6:1 on paper and the
  maroon-soft and forest-soft bands; play badge 9.3 / 10.0:1.

## Round 7: watch page polish

Refinement only: same tokens, type and identity (`WatchPage`, `src/features/watch/`).

- **Facts:** one wrapping list under the title: collection tab, date, channel, licence. The dots
  are clipped leads (`.watch-meta li::before` in a 1.25rem box), so a line never starts with one.
  Phones get 2 clean lines instead of 3 ragged ones.
- **Actions and Source:** only Save and Share stay as pills. The source links ("Watch on YouTube",
  "View on oer.upou.edu.ph") moved to a labelled **Source** row beside Topics. Both rows use
  `.watch-row`: the label sits above on phones and in a 4.5rem column from 40rem.
- **Description:** set at 33rem (median 65 to 70 characters a line, 76 at most from 768 up).
  Descriptions over 320 characters (`FOLD_AT`) open folded to 4 lines, with the last line trailing
  off, and get a "Show more / Show less" button (`aria-expanded`). Whether it folds depends only on
  length, so the toggle never turns up late (CLS 0). The height eases open only where the browser
  can animate to `auto`, and only when motion is allowed.
- **Up next:** where more rows lie beyond the scroll edge, that edge fades out (a scroll-driven
  mask; no fade where the browser cannot do it). Keyed rows stop clear of the fade
  (`scroll-padding-block`). Now playing is the forest wash plus its labelled "Now playing" line.
  There is no coloured edge bar. The hover frame appears only for `(hover: hover)`. Keyboard focus
  is the 3px inset ring.
- **Autoplay card:** set like the reel's end card. A spaced "UP NEXT" eyebrow, the serif title,
  facts (collection, date), "Starting in" with the seconds in a ring, then Play now (primary) and
  Cancel (secondary, which takes focus). A progress bar runs along the bottom edge (none with
  reduced motion). Picture at 44% beside the copy. Under a 30rem container the facts drop out and
  the buttons span the width. On stages wider than about 876px the body grows to 84cqi and the
  buttons go to the large size, so at 1920 the proportions match 1440 and the title is no longer
  clipped.
- **Backdrop:** takes the poster's crop zoom (`zoomStyle(cropZoomOf(src))`). It grows about the
  band's centre (`--shift`), so baked-in bars leave every side equally: measured overscan is equal
  left/right and top/bottom, and zoom-1 pages are unchanged. From 64rem the band fades out across
  the gap between the stage and Up next (a mask ending at `--stage-end`, the edge of the 8-of-12
  column), so the aside reads on plain paper. Over a still its 13px facts measured 2.97:1 (light)
  and 3.89:1 (dark). In dark the band mixes in more paper (72% / 84%).
- **Aside:** `lg:pt-14`, so the gold rule lines up with the top of the stage.
- **Measured** (Chrome; 360, 768, 1440 and 1920; both themes): AA all pass. Description 6.5:1
  light / 10.3:1 dark. Show more and Source links 8.9 / 11.2:1. Up next facts 5.2 / 6.0:1 (4.7 /
  4.7:1 on the Now playing wash). Autoplay card (always light): facts 6.5:1, "Starting in" 6.4:1,
  bar 6.9:1 against its track. Focus rings 8.9 / 11.2:1. CLS 0 and sideways overflow 0
  everywhere.

## Round 7: search

- **Search:** typo-tolerant and suggestive (`fuzzy.ts`, `suggest.ts`, `SearchSuggest.tsx`). A word
  rare as typed also matches more common catalog words an edit or two away, never names ("gendr" →
  "gender"); the page shows "Did you mean …?", or the fix's results when nothing matches. Both
  fields are ARIA comboboxes with up to six suggestions (fix, collections, topics, titles) after a
  100 ms pause; ↑ / ↓ walk them, the first Esc only closes the list. Typing sets no state, and the
  warm-up and each suggestion run in slices of about 4 ms, so at 4× CPU a key's input delay plus
  handling matches the page without suggestions.

## Round 7: quick look video focus

- **The still is the video:** a link that plays it (`Play <title>`), and the dialog opens with
  focus on it (`data-autofocus`), so Enter or OK plays at once. ↓ goes to Play
  (`data-spatial="over-entry"` → `"entry"`, otherwise the centre rule picked Save); → reaches the
  topics; Esc still closes and returns focus to the card's Details.
- **Grows on focus or hover:** from md the still's wrapper scales to 1.08 (300 ms
  `ease-out-soft`, `scale` only) while its link has focus (also after a mouse open, ring only for
  keyboard) or the pointer rests on it, and settles when focus moves to the buttons, text or tags.
  The wrapper scales because `:focus-visible` drops transitions (index.css). It grows into gutters
  set for it (`md:gap-y-7`, `lg:gap-x-10`), so nothing else moves: CLS 0, sideways overflow 0, the
  ring stays inside the card. No growth with reduced motion, and none on phones (full bleed), where
  keyboard focus is a 3px inset ring drawn over the picture by `::after` (the image is positioned
  and would cover an outline).
- **Bigger at rest from lg:** image 6/12 instead of 5/12. Measured (Chrome, Vite dev): 1440 still
  381×214 before, 459×258 at rest, 496×279 focused (18px clear of Play, 22px of the text); 768
  241×136 at rest, 261×147 focused; 360 330×186 either way.

## Round 7: featured hero and row

The flatten/expand idea was dropped. The top of the home page now has a permanent large hero for one featured video, and its content cycles.

- **Hero** (`src/components/Featured.tsx`, `Hero`): the picture is on the left. The detail column on the right opens with the "Featured" heading (gold rule and display h2), followed by the collection eyebrow, the title (h3), the facts line, the summary, and Play, Details and Save. On phones it stacks in this order: Featured, picture, details. It opens on the first featured video.
- **Featured row**: every featured video is the first row of cards (`VideoGrid` row layout, `aria-label="Featured videos"`). It has no heading and no arrows. From lg all five fit in one line (`.featured-row`, `--row-cols: 5`, about 249px cards at 1440 against 315px in the other rows). Below lg it scrolls sideways at the usual card size. Also new follows as an ordinary row, then the rest of the page.
- **Cycle**: the hero moves to the next featured video after `ADVANCE_MS` (7 s) of no click or key press. It pauses while the pointer is over the hero or the row, while focus is in them, while a preview plays, while a dialog is open, or while the tab is hidden. A card under a resting pointer (`HOVER_INTENT_MS`, 150 ms) or a card in focus takes over the hero at once. The active card has a gold outline round its picture (no tint), and a thin gold line along its foot counts down to the next video. The line is hidden with reduced motion.
- **Motion**: a View Transition, `html[data-hero-swap]`. The picture cross-fades in about 500 ms, while the text fades up out and settles back in. Pointer events pass through the transition layer. With reduced motion the swap is instant.
- **Remote**: a card in the Featured row reveals the whole hero above it rather than centring the row. This uses `data-reveal-whole` in `lib/spatial.ts`. On screens under 56rem tall (laptops), the hero tightens so that hero and row fit together: two-line title and summary, no facts line, and the picture cut at its foot, never the text.
- **Cue**: "More video resources below" shows from load until the footer comes into view (IntersectionObserver), and again after the footer leaves. It fades in once and nudges once. Each press scrolls the next row below the top one to the resting place, and from a keyboard it also focuses that row's first card. It steps aside while it would cover the card in focus, and it adds to `scroll-padding-bottom` while shown.
