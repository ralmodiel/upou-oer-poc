// Writes a crawlable copy of the built index.html for every indexable route (title, meta tags,
// JSON-LD and a plain-HTML fallback inside #root that React replaces on mount), plus sitemap.xml
// and robots.txt. Head tags come from the presets the app uses at runtime (src/lib/seo.ts), so
// crawlers and the app describe each page the same way.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  siteUrl,
  socialImageOf,
  videoSeo,
} from '../../src/lib/seo.ts'
import { registerNameTokens } from '../../src/lib/tags.ts'
import { watchUrl } from '../../src/lib/youtube.ts'
import { loadCatalog, newestFirst } from './catalog.mjs'

const CATALOG = fileURLToPath(new URL('../../src/data/catalog.json', import.meta.url))
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
    .replace(/<div id="root">[\s\S]*?<!--\/seo-fallback--><\/div>/, '<div id="root"></div>')
    .replace(/\n?[ \t]*<meta\b[^>]*\bname="description"[^>]*>/, '')

function shell(template, options, fallback) {
  const block = ['<!--seo-->', ...headTags(options).map(renderTag), '<!--/seo-->']
    .map((line) => `    ${line}`)
    .join('\n')
  return template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/, `<title>${esc(options.title)}</title>`)
    .replace(/\n[ \t]*<\/head>/, `\n${block}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root"><!--seo-fallback-->\n${fallback}\n<!--/seo-fallback--></div>`,
    )
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
    'Allow: /',
    `Disallow: ${basePath()}search`,
    `Disallow: ${basePath()}my-list`,
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
  // Same names as the app learns, so descriptions leave out the same people.
  registerNameTokens(() => videos)
  const newest = [...videos].sort(newestFirst)
  const byName = new Map(categories.map((c) => [c.name, c]))
  const files = []
  const urls = []

  // The app's hero (the newest featured video, else the newest) with its canonical image: the
  // site's preview, so never a flagged still (a video page previews the video's own image).
  const hero = newest.find((v) => v.featured) ?? newest[0]
  const home = homeSeo(
    videos.length,
    categories.length,
    hero && (hero.poster ?? socialImageOf(hero)),
  )
  files.push([
    join(dist, 'index.html'),
    shell(template, home, homeFallback(home, categories, newest.slice(0, LATEST))),
  ])
  urls.push({ loc: canonicalUrl('/'), lastmod: newest[0]?.publishedAt })

  const collections = collectionsSeo(categories)
  files.push([
    join(dist, 'collections', 'index.html'),
    shell(template, collections, collectionsFallback(collections, categories)),
  ])
  urls.push({ loc: canonicalUrl('/collections'), lastmod: newest[0]?.publishedAt })

  for (const c of categories) {
    files.push([
      join(dist, 'collections', c.slug, 'index.html'),
      shell(template, collectionSeo(c, c.videos), collectionFallback(c)),
    ])
    urls.push({ loc: canonicalUrl(`/collections/${c.slug}`), lastmod: c.cover.publishedAt })
  }
  for (const v of videos) {
    const c = byName.get(v.category)
    files.push([
      join(dist, 'watch', v.id, 'index.html'),
      shell(template, videoSeo(v, c), videoFallback(v, c)),
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
