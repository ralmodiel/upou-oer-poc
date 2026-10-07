// Head tags and schema.org data for every page. tools/seo/generate.mjs imports the builders under
// Node to write the static shells, so this module keeps DOM access inside functions, imports with
// .ts extensions and never loads the catalog itself.
import { useEffect } from 'react'
import type { Category } from '../data/catalog'
import type { Video } from '../types'
import { isGenericTag } from './tags.ts'
import { watchUrl } from './youtube.ts'

// The original image, never a rotating frame (maxres1.jpg …).
const canonicalImage = (url: string) =>
  url.replace(/\/(maxres|sd|mq)[123]\.jpg(\?|$)/, '/$1default.jpg$2')

/**
 * The link-preview image (og:image): the video's canonical image (the best unflagged candidate,
 * else the least bad), so a face the frame filter rejects shows only when every image is rejected.
 */
export const socialImageOf = (v: Video): string => v.poster ?? canonicalImage(v.backdrop)

export const SITE_NAME = 'UPOU OER'
export const PUBLISHER = 'University of the Philippines Open University'
const PUBLISHER_URL = 'https://www.upou.edu.ph/'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
/** Search results show about 60 characters of a title and 160 of a description. */
export const TITLE_MAX = 65
export const DESCRIPTION_MAX = 160
const LIST_MAX = 100
const ROBOTS_INDEX = 'index, follow, max-image-preview:large'
const ROBOTS_NOINDEX = 'noindex, follow'

export type JsonLd = Record<string, unknown>

// Vite inlines import.meta.env; under Node it is undefined.
const env: Partial<Record<string, string>> = import.meta.env ?? {}

const trimSlash = (s: string) => s.replace(/\/+$/, '')
const normalizeBase = (base = '/') => {
  const inner = base.replace(/^\/+|\/+$/g, '')
  return inner ? `/${inner}/` : '/'
}

interface Site {
  /** Absolute root without a trailing slash, e.g. "https://user.github.io/upou-networks". */
  url?: string
  /** Vite base path, e.g. "/upou-networks/". */
  base: string
}

let site: Site = {
  url: env.VITE_SITE_URL ? trimSlash(env.VITE_SITE_URL) : undefined,
  base: normalizeBase(env.BASE_URL),
}

/** Overrides VITE_SITE_URL and the base path (used by the shell generator and tests). */
export function configureSite(next: { url?: string; base?: string }): void {
  site = { url: next.url ? trimSlash(next.url) : undefined, base: normalizeBase(next.base) }
}

/** The base path with both slashes, e.g. "/upou-networks/". */
export const basePath = (): string => site.base

/** Site root without a trailing slash: VITE_SITE_URL, else this origin plus the base path. */
export function siteUrl(): string {
  if (site.url) return site.url
  const base = trimSlash(site.base)
  return typeof window === 'undefined' ? base : window.location.origin + base
}

/** Canonical URL of an app path: absolute, query and hash dropped, trailing slash (static shells are directories). */
export const canonicalUrl = (path: string): string =>
  `${siteUrl()}${trimSlash(path.replace(/[?#].*/, ''))}/`

export const embedUrlOf = (youtubeId: string) =>
  `https://www.youtube-nocookie.com/embed/${youtubeId}`

/** Collapses whitespace and, past `max` characters, cuts at a word boundary with an ellipsis. */
export function clamp(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  // Never keep half of a surrogate pair (an emoji cut in two).
  const head = s.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '')
  const space = head.lastIndexOf(' ')
  const kept = space >= max * 0.6 ? head.slice(0, space) : head
  return `${kept.replace(/[\s,;:·|–—-]+$/, '')}…`
}

/** "Main · UPOU OER" when that fits TITLE_MAX; longer titles keep their words and drop the suffix. */
export function pageTitle(main: string): string {
  const full = `${clamp(main, TITLE_MAX)} · ${SITE_NAME}`
  return full.length <= TITLE_MAX ? full : clamp(main, TITLE_MAX)
}

const monthYear = new Intl.DateTimeFormat('en', {
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Manila',
})

/** Meta description: the description when there is one, else title and facts. */
export function describeVideo(v: Video): string {
  if (v.description) return clamp(v.description, DESCRIPTION_MAX)
  const date = new Date(v.publishedAt)
  const published = Number.isNaN(date.getTime()) ? '' : ` · published ${monthYear.format(date)}`
  const topics = v.tags
    .filter((t) => !isGenericTag(t))
    .slice(0, 3)
    .join(', ')
  const facts = `${v.category} · ${v.channel}${published}${topics ? ` · Topics: ${topics}` : ''}`
  const text = `${clamp(v.title, 100)} · ${facts}`
  return clamp(text.length < 120 ? `${text} · Free to watch, CC BY 4.0.` : text, DESCRIPTION_MAX)
}

export const describeCollection = (c: Category): string =>
  clamp(
    `${c.name}: ${c.count} free open educational ${c.count === 1 ? 'video' : 'videos'} from UP Open University (${SITE_NAME}). Lectures, webinars and student work, free to watch online.`,
    DESCRIPTION_MAX,
  )

export const siteDescription = (videoCount: number, collectionCount: number): string =>
  clamp(
    `Open Educational Resources from the ${PUBLISHER}: ${videoCount.toLocaleString('en')} free videos in ${collectionCount} collections. Lectures, webinars and student work.`,
    DESCRIPTION_MAX,
  )

const schema = (data: JsonLd): JsonLd => ({ '@context': 'https://schema.org', ...data })
const organization = { '@type': 'Organization', name: PUBLISHER, url: PUBLISHER_URL }

export function videoJsonLd(v: Video): JsonLd {
  return schema({
    '@type': 'VideoObject',
    name: v.title,
    description: v.description || describeVideo(v),
    // Canonical images only, so never a still flagged for a face that is not smiling.
    thumbnailUrl: [...new Set([v.poster ?? v.backdrop, ...(v.thumbnails ?? [v.thumbnail])])],
    uploadDate: v.publishedAt,
    embedUrl: embedUrlOf(v.youtubeId),
    url: canonicalUrl(`/watch/${v.id}`),
    sameAs: [watchUrl(v.youtubeId), v.sourceUrl],
    genre: v.category,
    ...(v.tags.length ? { keywords: v.tags.join(', ') } : {}),
    publisher: organization,
    isAccessibleForFree: true,
    license: LICENSE_URL,
  })
}

/** CollectionPage with an ItemList of the first LIST_MAX videos. */
export function collectionJsonLd(c: Category, list: readonly Video[]): JsonLd {
  return schema({
    '@type': 'CollectionPage',
    name: c.name,
    description: describeCollection(c),
    url: canonicalUrl(`/collections/${c.slug}`),
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: canonicalUrl('/') },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.length,
      itemListElement: list.slice(0, LIST_MAX).map((v, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: v.title,
        url: canonicalUrl(`/watch/${v.id}`),
      })),
    },
  })
}

export const websiteJsonLd = (): JsonLd =>
  schema({
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'UPOU Open Educational Resources',
    url: canonicalUrl('/'),
    publisher: organization,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        // The search shell is a directory, so the slash saves a redirect.
        urlTemplate: `${siteUrl()}/search/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  })

/** Accepts the Breadcrumbs component's items; the last crumb usually has no `to`. */
export interface CrumbLike {
  label: string
  to?: string | { pathname?: string }
}

export function breadcrumbJsonLd(items: readonly CrumbLike[]): JsonLd {
  return schema({
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ label, to }, i) => {
      const path = typeof to === 'string' ? to : to?.pathname
      return {
        '@type': 'ListItem',
        position: i + 1,
        name: label,
        ...(path ? { item: canonicalUrl(path) } : {}),
      }
    }),
  })
}

// Characters that could end the script tag or start a comment or entity, plus the two line
// separators some JSON parsers reject; JSON strings may hold them as \u escapes.
const UNSAFE_IN_SCRIPT = /[<>&\u2028\u2029]/g
const escapeChar = (c: string) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`

/** JSON for a <script type="application/ld+json">: no text in it can close the tag. */
export const serializeJsonLd = (data: JsonLd | JsonLd[]): string =>
  JSON.stringify(data).replace(UNSAFE_IN_SCRIPT, escapeChar)

export interface SeoOptions {
  title: string
  description: string
  /** App path without the base, e.g. "/watch/<id>"; omitted on pages that are not indexed. */
  canonicalPath?: string
  /** Absolute image URL for link previews, ideally 1280×720. */
  image?: string
  type?: 'website' | 'video.other'
  /** Player URL, announced as og:video on watch pages. */
  embed?: string
  jsonLd?: JsonLd | JsonLd[]
  /** Keeps search, My List and not-found pages out of search results. */
  noindex?: boolean
}

export interface HeadTag {
  tag: 'meta' | 'link' | 'script'
  /** The first attribute identifies the tag (name, property, rel or type). */
  attrs: Record<string, string>
  text?: string
}

/** Every head tag a page needs besides <title>, for both the DOM and the static shells. */
export function headTags(o: SeoOptions): HeadTag[] {
  const meta = (key: string, content: string): HeadTag => ({
    tag: 'meta',
    attrs: { [key.startsWith('og:') ? 'property' : 'name']: key, content },
  })
  const tags: HeadTag[] = [
    meta('description', o.description),
    meta('robots', o.noindex ? ROBOTS_NOINDEX : ROBOTS_INDEX),
  ]
  if (o.canonicalPath !== undefined && !o.noindex) {
    const url = canonicalUrl(o.canonicalPath)
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url } }, meta('og:url', url))
  }
  tags.push(
    meta('og:site_name', SITE_NAME),
    meta('og:type', o.type ?? 'website'),
    meta('og:title', o.title),
    meta('og:description', o.description),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', o.title),
    meta('twitter:description', o.description),
  )
  if (o.image) {
    tags.push(
      meta('og:image', o.image),
      meta('og:image:alt', o.title),
      meta('twitter:image', o.image),
    )
  }
  if (o.embed) {
    tags.push(
      meta('og:video', o.embed),
      meta('og:video:type', 'text/html'),
      meta('og:video:width', '1280'),
      meta('og:video:height', '720'),
    )
  }
  if (o.jsonLd) {
    tags.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      text: serializeJsonLd(o.jsonLd),
    })
  }
  return tags
}

// Page presets, shared with the shell generator so crawlers and the app describe pages the same way.

export function homeSeo(videoCount: number, collectionCount: number, image?: string): SeoOptions {
  return {
    title: `${SITE_NAME} · Open Educational Resources from UP Open University`,
    description: siteDescription(videoCount, collectionCount),
    canonicalPath: '/',
    image,
    jsonLd: websiteJsonLd(),
  }
}

export function collectionsSeo(categories: readonly Category[]): SeoOptions {
  const videoCount = categories.reduce((n, c) => n + c.count, 0)
  return {
    title: pageTitle('Collections'),
    description: clamp(
      `All ${categories.length} UPOU OER collections: ${videoCount.toLocaleString('en')} free videos from UP Open University, from ${categories[0]?.name ?? 'the largest'} to the smallest, each newest first.`,
      DESCRIPTION_MAX,
    ),
    canonicalPath: '/collections',
    image: categories[0] && socialImageOf(categories[0].preview ?? categories[0].cover),
    jsonLd: breadcrumbJsonLd([{ label: 'Browse', to: '/' }, { label: 'Collections' }]),
  }
}

export function collectionSeo(category: Category, list: readonly Video[]): SeoOptions {
  return {
    title: pageTitle(`${category.name} · Collections`),
    description: describeCollection(category),
    canonicalPath: `/collections/${category.slug}`,
    image: socialImageOf(category.preview ?? category.cover),
    jsonLd: [
      collectionJsonLd(category, list),
      breadcrumbJsonLd([
        { label: 'Browse', to: '/' },
        { label: 'Collections', to: '/collections' },
        { label: category.name },
      ]),
    ],
  }
}

export function videoSeo(video: Video, category?: Pick<Category, 'name' | 'slug'>): SeoOptions {
  const crumbs: CrumbLike[] = [{ label: 'Browse', to: '/' }]
  if (category) crumbs.push({ label: category.name, to: `/collections/${category.slug}` })
  crumbs.push({ label: video.title })
  return {
    title: pageTitle(video.title),
    description: describeVideo(video),
    canonicalPath: `/watch/${video.id}`,
    image: socialImageOf(video),
    type: 'video.other',
    embed: embedUrlOf(video.youtubeId),
    jsonLd: [videoJsonLd(video), breadcrumbJsonLd(crumbs)],
  }
}

// Pages kept out of search results: no canonical, no sitemap entry. Their shells exist only so a
// direct load is a 200 rather than Pages' 404.html.

export function searchSeo(q = ''): SeoOptions {
  return {
    title: pageTitle(q ? `“${q}” · Search` : 'Search'),
    description: 'Search every UPOU OER video by title, topic or tag.',
    noindex: true,
  }
}

export function myListSeo(): SeoOptions {
  return {
    title: pageTitle('My List'),
    description: 'Videos you saved for later, kept in this browser.',
    noindex: true,
  }
}

// Runtime head management.

const MANAGED = 'data-seo'

// What the document had before the first page took over; restored when a page unmounts.
let initial: { title: string; description: string | null } | undefined

function upsert({ tag, attrs, text }: HeadTag) {
  const [key, value] = Object.entries(attrs)[0]
  const own = tag === 'script' ? `[${MANAGED}]` : ''
  let el = document.head.querySelector(`${tag}[${key}="${value}"]${own}`)
  if (!el) {
    el = document.createElement(tag)
    document.head.append(el)
  }
  for (const [name, v] of Object.entries(attrs)) el.setAttribute(name, v)
  el.setAttribute(MANAGED, '')
  if (text !== undefined) el.textContent = text
}

function apply(title: string, tags: HeadTag[]) {
  initial ??= {
    title: document.title,
    description:
      document.head.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
  }
  document.title = title
  tags.forEach(upsert)
}

function reset() {
  if (!initial) return
  document.title = initial.title
  for (const el of document.head.querySelectorAll(`[${MANAGED}]`)) {
    if (initial.description !== null && el.matches('meta[name="description"]')) {
      el.setAttribute('content', initial.description)
    } else {
      el.remove()
    }
  }
}

/**
 * Owns the document head while the calling page is mounted: title, description, robots, canonical,
 * Open Graph and Twitter tags and one JSON-LD script. Tags are reused by their data-seo attribute
 * (the static shells ship them), and everything is put back when the page unmounts. One page at a
 * time: nested calls would undo each other.
 */
export function useSeo(options: SeoOptions): void {
  // Serialized so that inline option objects do not re-run the effect on every render.
  const key = JSON.stringify(headTags(options))
  const { title } = options
  useEffect(() => {
    apply(title, JSON.parse(key) as HeadTag[])
    return reset
  }, [title, key])
}
