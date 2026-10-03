// Node-side view of the catalog. It mirrors src/data/expand.ts and the category grouping in
// src/data/catalog.ts, which Node cannot import (JSON import, extensionless paths);
// src/lib/seo.test.ts checks that the two agree.
const SOURCE_ORIGIN = 'https://oer.upou.edu.ph'
const DEFAULT_CHANNEL = 'UP Open University'
const ID_RE = /^[a-z0-9-]+$/
const YOUTUBE_ID_RE = /^[\w-]{11}$/

const image = (youtubeId, name) => `https://i.ytimg.com/vi/${youtubeId}/${name}.jpg`
const text = (value) => typeof value === 'string' && value.trim() !== ''

export const isValidRecord = (r) =>
  typeof r === 'object' &&
  r !== null &&
  typeof r.id === 'string' &&
  ID_RE.test(r.id) &&
  typeof r.y === 'string' &&
  YOUTUBE_ID_RE.test(r.y) &&
  text(r.t) &&
  text(r.c) &&
  typeof r.p === 'string' &&
  !Number.isNaN(Date.parse(r.p))

/** The Video a record expands to, with the first member of each image set (the app rotates them). */
export function expandRecord(r) {
  const size = r.m !== 0 ? 'maxres' : r.s === 0 ? 'mq' : 'sd'
  const thumbnails = ['mqdefault', 'mq1', 'mq2', 'mq3'].map((n) => image(r.y, n))
  return {
    id: r.id,
    youtubeId: r.y,
    title: r.t,
    description: r.d ?? '',
    category: r.c,
    tags: r.g ?? [],
    channel: r.ch ?? DEFAULT_CHANNEL,
    publishedAt: r.p,
    sourceUrl: `${SOURCE_ORIGIN}/${r.id}/`,
    thumbnail: thumbnails[0],
    thumbnails,
    backdrop: r.b ?? image(r.y, `${size}default`),
    frames: [1, 2, 3].map((n) => image(r.y, `${size}${n}`)),
    ...(r.f ? { featured: true } : {}),
  }
}

export const slugifyCategory = (name) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const stamp = (v) => Date.parse(v.publishedAt)
export const newestFirst = (a, b) => stamp(b) - stamp(a)

/** Videos in catalog order and categories largest first, each with its videos newest first. */
export function loadCatalog(records) {
  const videos = records.filter(isValidRecord).map(expandRecord)
  const bySlug = new Map()
  const byName = new Map()
  for (const v of videos) {
    let group = byName.get(v.category)
    if (!group) {
      const base = slugifyCategory(v.category) || 'other'
      let slug = base
      for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`
      group = { slug, name: v.category, videos: [] }
      byName.set(v.category, group)
      bySlug.set(slug, group)
    }
    group.videos.push(v)
  }
  const categories = [...bySlug.values()]
    .sort((a, b) => b.videos.length - a.videos.length || a.name.localeCompare(b.name))
    .map((group) => {
      const list = [...group.videos].sort(newestFirst)
      return {
        slug: group.slug,
        name: group.name,
        count: list.length,
        cover: list[0],
        videos: list,
      }
    })
  return { videos, categories }
}
