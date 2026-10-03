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
  2. **Recently viewed** strip (only when history exists): compact horizontal list with
     scroll snapping, no hover scaling.
  3. **Collections** chip row: every category with its count, linking to `/collections/:slug`;
     "All collections" link.
  4. **Sections:** the largest collections only (see "Round 4: a shorter home"), each a heading +
     "See all (n)" link and one row of cards (two rows of two on phones), then an "All 30
     collections" button. Grids, not horizontal rows, are the main browsing pattern. Below-the-fold
     sections render lazily (`content-visibility: auto` plus a sensible `contain-intrinsic-size`).
- **Card:** thumbnail (16:9, rounded, lazy, `srcSet` 320w/1280w with accurate `sizes`), then
  eyebrow (category, forest, small caps), title (sans semibold, 2-line clamp), meta (date ·
  "New" marker for the 10 newest). **Clicking the card plays** (`/watch/:id`). Secondary
  actions above the stretched link: bookmark (My List, `aria-pressed`) and info (Quick look),
  both visible on touch devices and on hover/focus-within on pointer devices. Hover: 2px lift +
  shadow + a small play glyph on the thumbnail. Keyboard: card link, then the two buttons.
- **Collections (`/collections`):** from md, a grid of category cards (a mosaic of the newest
  stills, name, count, 2–3 sample titles); on phones a compact list (see round 4).
  **Category (`/collections/:slug`):** title, count, sort control
  (Newest / Oldest / A–Z), full grid with "Load more" in pages of 24.
- **Search:** results grid with a category filter chip row and a result count; empty state with
  suggested topics; no results → suggestions.
- **My List:** grid in saved order, with an empty state linking to Collections.
- **Quick look dialog (`?v=`):** native `<dialog>`, centered card at ≥ md (image left 5/12,
  text right), full-screen sheet on mobile; title, meta, summary, tags, Play, My List, source
  links, and 6 "More like this" compact cards. Deep-linkable; history behavior as today.
- **Watch (`/watch/:id`):** two-column at `lg` (main 8/12, aside 4/12). Main: the **player
  stage** (16:9, rounded, surface background) where the promo reel plays and then the YouTube
  embed takes over; below it the serif title, meta row (category link · date · "Watch on
  YouTube" · "View on oer.upou.edu.ph" · Share/copy link · My List), summary/description, tag
  chips. Aside: "Up next" list (`similarTo`, 8 items, thumbnail + title + category) and a
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
360px; LCP image gets `fetchPriority="high"`, everything else lazy; CLS ≈ 0.

## Keyboard

- **Esc is Back everywhere** (user requirement). A single app-shell handler: if a dialog is open
  the dialog closes (native behavior); else if focus is in a text field, Esc clears/blurs that
  field (the search box keeps its own behavior); else `navigate(-1)` when there is in-app
  history, otherwise `navigate('/')`. Ignore events whose default was already prevented.
- **Watch page focus:** never move focus into the YouTube iframe automatically; focus the
  player stage container (`tabIndex={-1}`) instead, so Esc keeps working after the reel. When
  the user has clicked into the video (focus is inside the iframe) and the pointer leaves the
  stage, return focus to the stage container so Esc works again. Keep a visible Back button as
  well.
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
  remembered in `localStorage`): three cards — "Every video opens with a 10-second preview reel
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
  `noindex`. Shells and the running app describe a page identically: og:image is the video's own
  image (`original`; the home page uses the featured video's `poster`), and JSON-LD `thumbnailUrl`
  lists only stills the frame filter allows.
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
  backdrops, previews or the reel's footage. Image backdrops stay neutral (grayscale + paper/ink
  scrim). Brand color may frame an image (a border, a corner tab, a band beside it) but must not sit
  on top of it.
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

- **Frame filter:** candidate stills that catch a face not smiling, mid-word or looking angry are
  flagged at build time (`src/data/frame-flags.json`) and never used in the thumbnail rotation,
  the reel or the canonical slots (hero, quick look, poster), where the first clean still stands
  in for a flagged original; the original returns only when every candidate is flagged.
- **Repeated stills:** three cuts play only between three different stills; with fewer (repeats,
  or near-twins from a static lecture camera) the reel plays one long slow move on the first still.
- **No usable image:** when every image is flagged or missing (`q: 0` videos have no YouTube stills
  at all, only the thumbnail), the reel plays kinetic type on the night frame and ends on the night
  card, with no poster or backdrop behind the player.
- **Low-res stills** are framed rather than blown up, on a deep forest stage in both themes.
- **Title-card thumbnails:** reels whose only image is the designed original thumbnail use the
  split template, so the reel title sits beside the card instead of over its baked-in text; the
  card is never cropped: it settles from 92% to full size over a blurred grey copy of itself.
- **Previews:** the card's own image dissolves to footage within ~0.5 s (1.1 s preview lead) and
  the footage stays in colour, with the text on a band along the bottom; text travel is capped at
  large stages; kinetic titles enter a line at a time without overlapping words.
- **Hand-off:** the reel's end card and the player poster share `video.poster` (the original still
  unless flagged, else the first clean still), so the cut to the player is seamless.
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

Open dialogs scope the walk to their contents, and a sticky dialog header counts as a bar. In
settings panels the switches and their buttons share one column, so ↑ / ↓ visit them in order.

### Round 4: a shorter home

- **Cap:** from md, the 12 largest collections (General excluded), one row of cards each: three
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
