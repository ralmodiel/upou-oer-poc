// The catalog as the browser downloads it, in pieces: a small summary with only what the home
// page's first screen reads (its records and the catalog-wide counts), then the other records in
// files fetched after the first paint (catalog.ts merges them). Built by vite.config.ts. No runtime
// imports, so the build shares it.
//
// File 0, the pool, holds what a watch page's stand-in rows read: each collection's newest videos
// and the newest overall. Files 1..n hold every other record, by a hash of its id, so a link to one
// video knows which file to fetch (chunkOf) without an index.
import type { CatalogRecord } from '../types'
import { packCatalog, type CatalogPack } from './pack'
import { isValidRecord } from './records'
import { personKeysOf } from '../lib/tags'

/** What the home reads (BrowsePage, Featured, media.ts): keep in step with them. */
export const HOME = {
  /** getLatest(12): "Also new"; the New badges read the newest 10. */
  latest: 12,
  /** getFeatured(): featured first, then the newest. */
  featured: 5,
  /** Collection rows: SECTIONS, ROW_MIN and ROW_CARDS in BrowsePage. */
  rows: 12,
  rowMin: 12,
  rowCards: 16,
} as const

/**
 * A row's sixteen cards skip the titles shown above it (five featured, four also new): its first
 * 25 videos always cover them. Recently viewed would add more, so a browser with history loads
 * the whole catalog first (catalog.ts).
 */
export const ROW_POOL = HOME.rowCards + HOME.featured + 4

/** Each collection's newest videos kept in the pool: Up next's stand-ins read 16 at most. */
export const POOL_CATEGORY = 24
/** The newest overall kept in the pool (getLatest(16)). */
export const POOL_LATEST = 16

export interface HomeSummary {
  /** Videos in the whole catalog. */
  total: number
  /** Every category in catalog order (first appearance): name, slug, video count. */
  categories: [string, string, number][]
  /** Person keys of every speaker named in the catalog and the curated names (tags.ts). */
  people: string[]
  /** The first screen's records, and their positions in the whole catalog. */
  pack: CatalogPack
  at: number[]
}

/** A file of the rest of the catalog: records with their positions in the whole catalog. */
export interface CatalogPart extends CatalogPack {
  at: number[]
}

const GENERAL = 'General'

// As catalog.ts slugifyCategory and its "-2" suffixes.
const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The file (1..chunks) a record that is neither in the summary nor the pool is in. */
export function chunkOf(id: string, chunks: number): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return 1 + ((h >>> 0) % chunks)
}

/**
 * Splits the catalog (build time). Malformed records are dropped, as the app would skip them.
 * `chunks` 0 (the dev server, tests): every record is in the summary.
 */
export function splitCatalog(
  source: readonly unknown[],
  flags: Readonly<Record<string, unknown>>,
  speakers: Readonly<Record<string, string[]>>,
  chunks: number,
): { summary: HomeSummary; files: CatalogPart[] } {
  const records = source.filter(isValidRecord) as CatalogRecord[]
  const stamp = records.map((r) => Date.parse(r.p))
  // Newest first, catalog order between equals: as catalog.ts sorts.
  const newest = (list: number[]) => list.sort((a, b) => stamp[b] - stamp[a] || a - b)
  const all = newest(records.map((_, i) => i))

  const groups = new Map<string, { slug: string; members: number[] }>()
  const slugs = new Set<string>()
  records.forEach((r, i) => {
    let group = groups.get(r.c)
    if (!group) {
      const base = slugify(r.c) || 'other'
      let slug = base
      for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`
      slugs.add(slug)
      groups.set(r.c, (group = { slug, members: [] }))
    }
    group.members.push(i)
  })

  const keep = new Set<number>(all.slice(0, Math.max(HOME.latest, HOME.featured)))
  records.forEach((r, i) => r.f && keep.add(i))
  const byLatest = [...groups.entries()].map(([name, g]) => ({
    name,
    count: g.members.length,
    list: newest(g.members),
  }))
  // Each collection's newest video is its cover.
  for (const g of byLatest) keep.add(g.list[0])
  // getCategories('latest'): General last, then the newest video, the size and the name.
  byLatest.sort(
    (a, b) =>
      Number(a.name === GENERAL) - Number(b.name === GENERAL) ||
      stamp[b.list[0]] - stamp[a.list[0]] ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  )
  byLatest
    .filter((g) => g.count >= HOME.rowMin && g.name !== GENERAL)
    .slice(0, HOME.rows)
    .forEach((g) => g.list.slice(0, ROW_POOL).forEach((i) => keep.add(i)))

  const pool = new Set<number>()
  if (chunks) {
    all.slice(0, POOL_LATEST).forEach((i) => keep.has(i) || pool.add(i))
    for (const g of byLatest)
      g.list.slice(0, POOL_CATEGORY).forEach((i) => keep.has(i) || pool.add(i))
  }

  const at = records.map((_, i) => i).filter((i) => keep.has(i) || !chunks)
  const files: number[][] = Array.from({ length: chunks ? chunks + 1 : 0 }, () => [])
  records.forEach((r, i) => {
    if (keep.has(i) || !chunks) return
    files[pool.has(i) ? 0 : chunkOf(r.id, chunks)].push(i)
  })
  const pack = (list: number[]) =>
    packCatalog(
      list.map((i) => records[i]),
      flags,
      speakers,
    )
  const named = new Set<string>()
  for (const r of records)
    for (const name of Object.hasOwn(speakers, r.y) ? speakers[r.y] : []) named.add(name)
  return {
    summary: {
      total: records.length,
      categories: [...groups].map(([name, g]) => [name, g.slug, g.members.length]),
      people: personKeysOf(named),
      pack: pack(at),
      at,
    },
    files: files.map((list) => ({ ...pack(list), at: list })),
  }
}
