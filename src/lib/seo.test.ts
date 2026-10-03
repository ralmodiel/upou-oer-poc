import { renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
import records from '../data/catalog.json'
import { expandRecord } from '../data/expand'
import type { CatalogRecord, Video } from '../types'
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  breadcrumbJsonLd,
  canonicalUrl,
  clamp,
  collectionJsonLd,
  collectionSeo,
  collectionsSeo,
  configureSite,
  describeVideo,
  headTags,
  homeSeo,
  myListSeo,
  pageTitle,
  searchSeo,
  serializeJsonLd,
  useSeo,
  videoJsonLd,
  videoSeo,
  websiteJsonLd,
  type JsonLd,
  type SeoOptions,
} from './seo'

const SITE = 'https://example.github.io/upou-networks'
const slim = records as CatalogRecord[]
const video = fixtureVideos[0]
const category = { slug: 'research', name: 'Research', count: 3, cover: video }

const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content')
const jsonLd = () => {
  const script = document.head.querySelector('script[type="application/ld+json"]')
  return script ? (JSON.parse(script.textContent ?? '') as JsonLd | JsonLd[]) : undefined
}

beforeEach(() => {
  configureSite({ url: SITE, base: '/upou-networks/' })
  document.title = 'Default title'
  let meta = document.head.querySelector('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    document.head.append(meta)
  }
  meta.setAttribute('content', 'Default description')
})

describe('text', () => {
  it('clamps at a word boundary with an ellipsis', () => {
    expect(clamp('short', 10)).toBe('short')
    expect(clamp('The quick brown fox jumps over the lazy dog', 20)).toBe('The quick brown…')
    expect(clamp('  spaced   out  ', 50)).toBe('spaced out')
  })

  it('keeps every title within TITLE_MAX', () => {
    expect(pageTitle('Collections')).toBe('Collections · UPOU OER')
    expect(pageTitle('x'.repeat(100))).toBe(`${'x'.repeat(64)}…`)
    for (const r of slim) expect(pageTitle(r.t).length).toBeLessThanOrEqual(TITLE_MAX)
  })

  it('describes every video in at most DESCRIPTION_MAX characters', () => {
    const lengths = slim.map((r) => describeVideo(expandRecord(r)).length)
    expect(Math.max(...lengths)).toBeLessThanOrEqual(DESCRIPTION_MAX)
    expect(lengths.filter((n) => n < 120).length).toBeLessThan(slim.length / 50)
    expect(describeVideo({ ...video, description: '' })).toBe(
      'Climate Change Basics · Research · UP Open University · published May 2026 · Topics: Climate, Science · Free to watch, CC BY 4.0.',
    )
  })
})

describe('urls', () => {
  it('builds canonical URLs from VITE_SITE_URL, else from the origin and base path', () => {
    expect(canonicalUrl('/watch/x?v=1#t')).toBe(`${SITE}/watch/x/`)
    expect(canonicalUrl('/')).toBe(`${SITE}/`)
    configureSite({ base: '/upou-networks/' })
    expect(canonicalUrl('/collections')).toBe(
      `${window.location.origin}/upou-networks/collections/`,
    )
    configureSite({})
    expect(canonicalUrl('/collections/')).toBe(`${window.location.origin}/collections/`)
  })
})

describe('JSON-LD', () => {
  it('describes a video as a free VideoObject', () => {
    const v: Video = {
      ...video,
      thumbnails: ['https://img.test/mq.jpg', 'https://img.test/mq1.jpg'],
    }
    const ld = videoJsonLd(v)
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: v.title,
      description: v.description,
      uploadDate: v.publishedAt,
      embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
      url: `${SITE}/watch/climate-basics/`,
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/licenses/by/4.0/',
      publisher: { '@type': 'Organization', name: 'University of the Philippines Open University' },
    })
    expect(ld.thumbnailUrl).toEqual([v.backdrop, ...v.thumbnails!])
  })

  it('previews and lists only the clean canonical image and stills, never a flagged original', () => {
    const still = (name: string) => `https://i.ytimg.com/vi/abcdefghijk/${name}.jpg`
    // The original is flagged (a face not smiling): the poster is the first clean still.
    const v: Video = {
      ...video,
      thumbnails: [still('mq2'), still('mq2'), still('mq3'), still('mq2')],
      backdrop: still('maxres3'),
      poster: still('maxres2'),
    }
    expect(videoSeo(v).image).toBe(still('maxres2'))
    expect(videoJsonLd(v).thumbnailUrl).toEqual([still('maxres2'), still('mq2'), still('mq3')])
    // Without a poster, the rotating frame maps back to the original.
    expect(videoSeo({ ...v, poster: undefined }).image).toBe(still('maxresdefault'))
  })

  it('previews a collection with its newest clean video', () => {
    const preview = { ...video, id: 'clean', poster: 'https://i.ytimg.com/vi/abcdefghijk/mq1.jpg' }
    expect(collectionSeo({ ...category, preview }, [video]).image).toBe(preview.poster)
    expect(collectionsSeo([{ ...category, preview }]).image).toBe(preview.poster)
    expect(collectionSeo(category, [video]).image).toBe(video.poster ?? video.backdrop)
  })

  it('lists at most 100 videos of a collection', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...video,
      id: `v-${i}`,
      title: `Video ${i}`,
    }))
    const ld = collectionJsonLd({ ...category, count: 120 }, many) as {
      mainEntity: { numberOfItems: number; itemListElement: unknown[] }
    }
    expect(ld.mainEntity.numberOfItems).toBe(120)
    expect(ld.mainEntity.itemListElement).toHaveLength(100)
    expect(ld.mainEntity.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Video 0',
      url: `${SITE}/watch/v-0/`,
    })
  })

  it('points the site search action at the /search/ shell', () => {
    expect(websiteJsonLd()).toMatchObject({
      '@type': 'WebSite',
      url: `${SITE}/`,
      potentialAction: { target: { urlTemplate: `${SITE}/search/?q={search_term_string}` } },
    })
  })

  it('turns breadcrumbs into a BreadcrumbList without a link on the last crumb', () => {
    const ld = breadcrumbJsonLd([
      { label: 'Browse', to: '/' },
      { label: 'Research', to: { pathname: '/collections/research' } },
      { label: 'Title' },
    ])
    expect(ld.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Browse', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Research', item: `${SITE}/collections/research/` },
      { '@type': 'ListItem', position: 3, name: 'Title' },
    ])
  })

  it('escapes what could close the script tag, and the output is still JSON', () => {
    const text = '</script><!-- a & b > c \u2028\u2029'
    const out = serializeJsonLd({ a: text })
    expect(out).toBe('{"a":"\\u003c/script\\u003e\\u003c!-- a \\u0026 b \\u003e c \\u2028\\u2029"}')
    expect(out).not.toMatch(/[<>&\u2028\u2029]/)
    expect(JSON.parse(out)).toEqual({ a: text })
  })

  it('uses noindex and no canonical for private pages', () => {
    const tags = headTags({
      title: 'My List',
      description: 'd',
      canonicalPath: '/my-list',
      noindex: true,
    })
    expect(tags.find((t) => t.attrs.name === 'robots')?.attrs.content).toBe('noindex, follow')
    expect(tags.some((t) => t.attrs.rel === 'canonical' || t.attrs.property === 'og:url')).toBe(
      false,
    )
  })

  it('keeps Search and My List out of the index, naming the query in the title', () => {
    for (const o of [searchSeo(), searchSeo('climate'), myListSeo()]) {
      expect(o.noindex).toBe(true)
      expect(o.canonicalPath).toBeUndefined()
      expect(o.title.length).toBeLessThanOrEqual(TITLE_MAX)
    }
    expect(searchSeo('climate').title).toBe('“climate” · Search · UPOU OER')
    expect(myListSeo().title).toBe('My List · UPOU OER')
  })
})

describe('useSeo', () => {
  it('keeps one tag of each kind, follows updates and restores the defaults on unmount', () => {
    const { rerender, unmount } = renderHook((o: SeoOptions) => useSeo(o), {
      initialProps: videoSeo(video, category),
    })
    expect(document.title).toBe('Climate Change Basics · UPOU OER')
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(content('meta[name="description"]')).toBe('About Climate Change Basics.')
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE}/watch/climate-basics/`,
    )
    expect(content('meta[property="og:type"]')).toBe('video.other')
    expect(content('meta[property="og:video"]')).toBe(
      'https://www.youtube-nocookie.com/embed/abcdefghijk',
    )
    expect((jsonLd() as JsonLd[]).map((x) => x['@type'])).toEqual(['VideoObject', 'BreadcrumbList'])

    rerender(homeSeo(10, 2, 'https://img.test/home.jpg'))
    expect(document.title).toBe('UPOU OER · Open Educational Resources from UP Open University')
    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1)
    expect(content('meta[property="og:type"]')).toBe('website')
    expect(content('meta[property="og:image"]')).toBe('https://img.test/home.jpg')
    expect(document.head.querySelector('meta[property="og:video"]')).toBeNull()
    expect((jsonLd() as JsonLd)['@type']).toBe('WebSite')

    unmount()
    expect(document.title).toBe('Default title')
    expect(content('meta[name="description"]')).toBe('Default description')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
    // Only the adopted description meta stays behind.
    expect(document.head.querySelectorAll('[data-seo]')).toHaveLength(1)
  })

  it('survives StrictMode double effects', () => {
    const { unmount } = renderHook(() => useSeo(videoSeo(video)), { wrapper: StrictMode })
    expect(document.title).toBe('Climate Change Basics · UPOU OER')
    expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1)
    expect(document.head.querySelectorAll('[data-seo]').length).toBeGreaterThan(10)
    unmount()
    expect(document.title).toBe('Default title')
    expect(document.head.querySelectorAll('[data-seo]')).toHaveLength(1)
  })
})
