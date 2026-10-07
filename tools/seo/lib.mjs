// Writes a crawlable copy of the built index.html for every indexable route (title, meta tags,
// JSON-LD and a plain-HTML fallback inside #root that React replaces on mount), plus sitemap.xml
// and robots.txt. Head tags come from the presets the app uses at runtime (src/lib/seo.ts), so
// crawlers and the app describe each page the same way. Search and My List get noindex shells
// too, outside the sitemap, so that loading them directly is a 200 rather than Pages' 404.html.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import CROPS from '../../src/data/frame-crops.json' with { type: 'json' }
import FLAGS from '../../src/data/frame-flags.json' with { type: 'json' }
import SPEAKERS from '../../src/data/speakers.json' with { type: 'json' }
import {
  STAGE_SIZES,
  candidateOf,
  isCleanImage,
  slotImages,
  widthOf,
  youtubeIdOf,
  zoomFrom,
} from '../../src/data/images.ts'
import { formatDate } from '../../src/lib/format.ts'
import {
  SITE_NAME,
  basePath,
  canonicalUrl,
  collectionSeo,
  collectionsSeo,
  configureSite,
  headTags,
  homeSeo,
  myListSeo,
  searchSeo,
  siteUrl,
  socialImageOf,
  videoSeo,
} from '../../src/lib/seo.ts'
import { personKeysOf, registerNameTokens, registerPersonKeys } from '../../src/lib/tags.ts'
import { watchUrl } from '../../src/lib/youtube.ts'
import { hasCleanPoster, isGeneral, loadCatalog, newestFirst, posterOf } from './catalog.mjs'
import { chromeMarkup } from './chrome.mjs'

const CATALOG = fileURLToPath(new URL('../../src/data/catalog.json', import.meta.url))

// The home lists collections as the app does: the one with the newest video first, General last.
const latestFirst = (categories) =>
  [...categories].sort(
    (a, b) =>
      isGeneral(a.name) - isGeneral(b.name) ||
      newestFirst(a.cover, b.cover) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  )
const LATEST = 12
const LIST_MAX = 100
const SITEMAP_MAX = 50_000

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  )

const renderTag = ({ tag, attrs, text }) => {
  const a = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('')
  return tag === 'script' ? `<script${a} data-seo>${text}</script>` : `<${tag}${a} data-seo />`
}

/** The built index.html with an earlier run's additions removed, so runs are repeatable. */
export const templateOf = (html) =>
  html
    .replace(/\n?[ \t]*<!--seo-->[\s\S]*?<!--\/seo-->/, '')
    .replace(/\n?[ \t]*<script\b[^>]*\bdata-theme-boot\b[^>]*><\/script>/, '')
    .replace(/<div id="root">[\s\S]*?<!--\/seo-fallback--><\/div>/, '<div id="root"></div>')
    .replace(/\n?[ \t]*<meta\b[^>]*\bname="description"[^>]*>/, '')

// With a `section` ('home', 'collections', 'my-list', or null for none) the page also gets the
// app's header and tab bar (chrome.mjs), painted from the HTML while the scripts load, and the
// theme script ahead of the stylesheet and scripts (it waits for neither). Left out on the search
// page, whose header field shows the query.
function shell(template, options, fallback, extra = [], section, catalogFiles = '') {
  const block = ['<!--seo-->', ...[...headTags(options), ...extra].map(renderTag), '<!--/seo-->']
    .map((line) => `    ${line}`)
    .join('\n')
  const chrome = section === undefined ? '' : chromeMarkup(basePath(), section)
  const boot = chrome
    ? `<script src="${basePath()}theme-boot.js" data-theme-boot${catalogFiles ? ` data-catalog="${catalogFiles}"` : ''}></script>\n    `
    : ''
  return template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/, () => `${boot}<title>${esc(options.title)}</title>`)
    .replace(/\n[ \t]*<\/head>/, () => `\n${block}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      () =>
        `<div id="root">${chrome}<!--seo-fallback-->\n<div class="seo-fallback">\n${fallback}\n</div>\n<!--/seo-fallback--></div>`,
    )
}

// The home's largest paint is the featured video's still, which React renders only after the
// scripts run. The shell holds a preload for exactly the file the hero then shows (its poster, with
// the hero's srcSet and sizes), off (media="not all") until public/theme-boot.js sees the
// stylesheet arrive: started with the HTML it pushed the stylesheet back (first paint +0.2 s on a
// slow link); started after it, first paint is unchanged and the still lands 0.4-0.8 s sooner.
// generate.test.mjs keeps HERO_SIZES equal to src/components/media.ts.
const HERO_SIZES =
  '(min-width: 64rem) 55vw, (min-resolution: 2.5dppx) and (orientation: portrait) 45vw, (min-resolution: 2.5dppx) 22vw, 100vw'
// What media.ts thumbnailOf(video, true) picks for the hero (heroImageOf, else the least bad image).
const FRAME = /\/(maxres|sd|mq)[123]\.jpg(\?|$)/
function heroPreload(v) {
  if (!v) return null
  const flags = FLAGS[v.youtubeId]
  const clean = (src) => !!src && isCleanImage(flags, src)
  const original = v.backdrop.replace(FRAME, '/$1default.jpg$2')
  const fallback = widthOf(original) >= 640 ? original : v.thumbnails?.[0]
  const best = [v.poster, fallback, ...v.frames].find(clean)
  const large = best ?? v.poster ?? v.thumbnail
  const small =
    v.thumbnails?.find((s) => candidateOf(s) === candidateOf(large) && (!best || clean(s))) ??
    (best ? large : v.thumbnail)
  const { srcSet } = slotImages(small, large, (src) => zoomFrom(CROPS[youtubeIdOf(src)], src))
  const sizes = srcSet ? { imagesrcset: srcSet, imagesizes: HERO_SIZES } : {}
  return {
    tag: 'link',
    attrs: {
      rel: 'preload',
      as: 'image',
      href: large,
      ...sizes,
      media: 'not all',
      'data-hero': '',
    },
  }
}

// A watch page's largest paint is its player poster, which React renders only after the scripts
// run: the shell starts that download at once, for exactly the file the page then shows (with the
// stage's srcSet and sizes when it has one), so phones and desktops each fetch one size.
function posterPreload(v) {
  const { href, srcSet } = posterOf(v)
  const sizes = srcSet ? { imagesrcset: srcSet, imagesizes: STAGE_SIZES } : {}
  return {
    tag: 'link',
    attrs: { rel: 'preload', as: 'image', href, ...sizes, fetchpriority: 'high' },
  }
}

// Fallback markup uses utility classes the app already ships, so it is styled until React mounts.
const link = (href, text, external = false) =>
  `<a href="${esc(href)}"${external ? ' rel="noopener noreferrer"' : ''} class="font-semibold text-maroon hover:underline">${esc(text)}</a>`
const videoItem = (v) =>
  `<li>${link(canonicalUrl(`/watch/${v.id}`), v.title)} <span class="text-sm text-ink-3">${esc(formatDate(v.publishedAt))}</span></li>`
const collectionItem = (c) =>
  `<li>${link(canonicalUrl(`/collections/${c.slug}`), c.name)} <span class="text-sm text-ink-3">${c.count}</span></li>`
const page = (eyebrow, title, ...rest) =>
  [
    '<main class="mx-auto w-full max-w-[1600px] px-(--gutter) pt-6 pb-16">',
    `<p class="eyebrow">${esc(eyebrow)}</p>`,
    `<h1 class="mt-3 font-display text-title text-ink">${esc(title)}</h1>`,
    ...rest.filter(Boolean),
    `<p class="mt-6 text-sm text-ink-3">Videos and descriptions © UP Open University (CC BY 4.0), streamed from YouTube.</p>`,
    '</main>',
  ].join('\n')

const homeFallback = (options, categories, latest) =>
  page(
    SITE_NAME,
    'Open Educational Resources from UP Open University',
    `<p class="mt-3 max-w-prose text-ink-2">${esc(options.description)}</p>`,
    '<h2 class="mt-6 font-display text-xl text-ink">Collections</h2>',
    `<ul class="mt-3 space-y-2">\n${categories.map(collectionItem).join('\n')}\n</ul>`,
    '<h2 class="mt-6 font-display text-xl text-ink">Latest</h2>',
    `<ul class="mt-3 space-y-2">\n${latest.map(videoItem).join('\n')}\n</ul>`,
  )

const collectionsFallback = (options, categories) =>
  page(
    SITE_NAME,
    'Collections',
    `<p class="mt-3 max-w-prose text-ink-2">${esc(options.description)}</p>`,
    `<ul class="mt-6 space-y-2">\n${categories.map(collectionItem).join('\n')}\n</ul>`,
  )

const collectionFallback = (c) =>
  page(
    `${SITE_NAME} · Collections`,
    c.name,
    `<p class="mt-3 text-ink-2">${c.count} ${c.count === 1 ? 'video' : 'videos'} · UP Open University</p>`,
    `<ul class="mt-6 space-y-2">\n${c.videos.slice(0, LIST_MAX).map(videoItem).join('\n')}\n</ul>`,
    c.count > LIST_MAX
      ? `<p class="mt-3 text-sm text-ink-3">Showing ${LIST_MAX} of ${c.count}; the rest load with the app.</p>`
      : '',
    `<p class="mt-6">${link(canonicalUrl('/'), 'Browse all videos')}</p>`,
  )

const videoFallback = (v, c) =>
  page(
    `${SITE_NAME}${c ? ` · ${c.name}` : ''}`,
    v.title,
    `<p class="mt-3 text-ink-2">${esc(v.channel)} · ${esc(v.category)} · ${esc(formatDate(v.publishedAt))}</p>`,
    v.description ? `<p class="mt-5 max-w-prose text-ink-2">${esc(v.description)}</p>` : '',
    '<ul class="mt-6 space-y-2">',
    `<li>${link(watchUrl(v.youtubeId), 'Watch on YouTube', true)}</li>`,
    `<li>${link(v.sourceUrl, 'Source page on oer.upou.edu.ph', true)}</li>`,
    c
      ? `<li>${link(canonicalUrl(`/collections/${c.slug}`), `More in ${c.name} (${c.count})`)}</li>`
      : '',
    `<li>${link(canonicalUrl('/'), 'Browse all videos')}</li>`,
    '</ul>',
  )

// Search and My List render from this browser's state, so their fallbacks only say what they are.
const appFallback = (options, title) =>
  page(
    SITE_NAME,
    title,
    `<p class="mt-3 max-w-prose text-ink-2">${esc(options.description)}</p>`,
    `<p class="mt-6">${link(canonicalUrl('/'), 'Browse all videos')}</p>`,
  )

const urlset = (urls) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(
      ({ loc, lastmod }) =>
        `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${esc(lastmod)}</lastmod>` : ''}</url>`,
    ),
    '</urlset>',
    '',
  ].join('\n')

/** sitemap.xml, or a sitemap index over numbered parts when there are too many URLs. */
function sitemapFiles(dist, urls, max) {
  if (urls.length <= max) return [[join(dist, 'sitemap.xml'), urlset(urls)]]
  const parts = []
  for (let i = 0; i < urls.length; i += max) parts.push(urls.slice(i, i + max))
  const files = parts.map((part, i) => [join(dist, `sitemap-${i + 1}.xml`), urlset(part)])
  const index = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...parts.map(
      (_, i) => `  <sitemap><loc>${esc(`${siteUrl()}/sitemap-${i + 1}.xml`)}</loc></sitemap>`,
    ),
    '</sitemapindex>',
    '',
  ].join('\n')
  return [[join(dist, 'sitemap.xml'), index], ...files]
}

const robots = (withSitemap) =>
  [
    'User-agent: *',
    // No Disallow for /search and /my-list: their shells say noindex, which a crawler only reads
    // if it may fetch them.
    'Allow: /',
    ...(withSitemap ? ['', `Sitemap: ${siteUrl()}/sitemap.xml`] : []),
    '',
  ].join('\n')

async function writeAll(files, concurrency = 64) {
  let next = 0
  let bytes = 0
  const worker = async () => {
    while (next < files.length) {
      const [path, content] = files[next++]
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content)
      bytes += Buffer.byteLength(content)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker))
  return bytes
}

// The home shell lists the app's catalog files (vite.config.ts, catalog-<n>-<hash>.json), in order,
// for public/theme-boot.js. None in a dist without them (tests).
async function catalogFilesOf(dist) {
  const names = (await readdir(join(dist, 'assets')).catch(() => []))
    .map((name) => /^catalog-(\d+)-[0-9a-f]+\.json$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => a[1] - b[1])
  return names.map((m) => `${basePath()}assets/${m[0]}`).join(' ')
}

/**
 * Generates the shells, sitemap and robots.txt into `dist`. `site` (VITE_SITE_URL) makes every
 * URL absolute; without it canonicals are base-relative and no sitemap is written.
 */
export async function generate({
  dist = 'dist',
  site = process.env.VITE_SITE_URL,
  base = process.env.BASE_PATH || '/',
  records,
  limit,
  sitemapMax = SITEMAP_MAX,
} = {}) {
  const started = performance.now()
  configureSite({ url: site, base })
  const template = templateOf(await readFile(join(dist, 'index.html'), 'utf8'))
  records ??= JSON.parse(await readFile(CATALOG, 'utf8'))
  const { videos, categories } = loadCatalog(limit ? records.slice(0, limit) : records)
  // Same names and speakers as the app learns (catalog.ts, split.ts), so descriptions leave out the
  // same people.
  registerNameTokens(() => videos)
  registerPersonKeys(
    personKeysOf(
      videos.flatMap((v) => (Object.hasOwn(SPEAKERS, v.youtubeId) ? SPEAKERS[v.youtubeId] : [])),
    ),
  )
  const newest = [...videos].sort(newestFirst)
  const byName = new Map(categories.map((c) => [c.name, c]))
  const files = []
  const urls = []

  // The site's preview: the newest featured video whose canonical image passes the frame filter
  // (else the newest such video), so it never shows a face the filter rejects.
  const hero =
    newest.find((v) => v.featured && hasCleanPoster(v)) ??
    newest.find((v) => hasCleanPoster(v)) ??
    newest[0]
  const home = homeSeo(videos.length, categories.length, hero && socialImageOf(hero))
  files.push([
    join(dist, 'index.html'),
    shell(
      template,
      home,
      homeFallback(home, latestFirst(categories), newest.slice(0, LATEST)),
      [heroPreload(newest.find((v) => v.featured) ?? newest[0])].filter(Boolean),
      'home',
      await catalogFilesOf(dist),
    ),
  ])
  urls.push({ loc: canonicalUrl('/'), lastmod: newest[0]?.publishedAt })

  const collections = collectionsSeo(categories)
  files.push([
    join(dist, 'collections', 'index.html'),
    shell(template, collections, collectionsFallback(collections, categories), [], 'collections'),
  ])
  urls.push({ loc: canonicalUrl('/collections'), lastmod: newest[0]?.publishedAt })

  // A shell for each app-only page: Pages answers /search?q=… with a 301 to /search/?q=…
  // (query kept) and then a 200, instead of a 404 status from 404.html.
  const search = searchSeo()
  const myList = myListSeo()
  files.push(
    [join(dist, 'search', 'index.html'), shell(template, search, appFallback(search, 'Search'))],
    [
      join(dist, 'my-list', 'index.html'),
      shell(template, myList, appFallback(myList, 'My List'), [], 'my-list'),
    ],
  )

  for (const c of categories) {
    files.push([
      join(dist, 'collections', c.slug, 'index.html'),
      shell(template, collectionSeo(c, c.videos), collectionFallback(c), [], 'collections'),
    ])
    urls.push({ loc: canonicalUrl(`/collections/${c.slug}`), lastmod: c.cover.publishedAt })
  }
  for (const v of videos) {
    const c = byName.get(v.category)
    files.push([
      join(dist, 'watch', v.id, 'index.html'),
      shell(template, videoSeo(v, c), videoFallback(v, c), [posterPreload(v)], null),
    ])
    urls.push({ loc: canonicalUrl(`/watch/${v.id}`), lastmod: v.publishedAt })
  }

  if (site) files.push(...sitemapFiles(dist, urls, sitemapMax))
  files.push([join(dist, 'robots.txt'), robots(Boolean(site))])
  const bytes = await writeAll(files)
  return {
    files: files.length,
    bytes,
    urls: urls.length,
    sitemap: Boolean(site),
    ms: performance.now() - started,
  }
}
