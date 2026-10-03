// Node-side view of the catalog. It mirrors src/data/expand.ts and the category grouping in
// src/data/catalog.ts, which Node cannot import (JSON import, extensionless paths); images come
// from the same src/data/images.ts. tools/seo/generate.test.mjs checks that the two agree.
import FLAGS from '../../src/data/frame-flags.json' with { type: 'json' }
import { flagsOf, isCleanImage, videoImages } from '../../src/data/images.ts'

const SOURCE_ORIGIN = 'https://oer.upou.edu.ph'
const DEFAULT_CHANNEL = 'UP Open University'
const GENERAL_CATEGORY = 'General'
const ID_RE = /^[a-z0-9-]+$/
const YOUTUBE_ID_RE = /^[\w-]{11}$/

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

/** The Video a record expands to, showing the canonical image where the app rotates them. */
export function expandRecord(r, flags = FLAGS) {
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
    ...videoImages(r, flagsOf(flags[r.y])),
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

export const isGeneral = (name) => Number(name === GENERAL_CATEGORY)

/** Whether the video's canonical image passes the frame filter (it fails only when all do). */
export const hasCleanPoster = (v, flags = FLAGS) =>
  !!v.poster && isCleanImage(flags[v.youtubeId], v.poster)

/**
 * Videos in catalog order and categories largest first (General, posts without a subject, last),
 * each with its videos newest first.
 */
export function loadCatalog(records, flags = FLAGS) {
  const videos = records.filter(isValidRecord).map((r) => expandRecord(r, flags))
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
    .sort(
      (a, b) =>
        isGeneral(a.name) - isGeneral(b.name) ||
        b.videos.length - a.videos.length ||
        a.name.localeCompare(b.name),
    )
    .map((group) => {
      const list = [...group.videos].sort(newestFirst)
      return {
        slug: group.slug,
        name: group.name,
        count: list.length,
        cover: list[0],
        preview: list.find((v) => hasCleanPoster(v, flags)),
        videos: list,
      }
    })
  return { videos, categories }
}
