import { describe, expect, it, vi } from 'vitest'
import type { Video } from '../types'

// The build's split, served as the browser gets it on a first visit: the summary at once, the files
// on request (virtual modules and fetch stubbed).
const h = await vi.hoisted(async () => {
  const { splitCatalog } = await import('./split')
  const records = (await import('./catalog.json')).default
  const flags = (await import('./frame-flags.json')).default
  const speakers = (await import('./speakers.json')).default
  return { records, split: splitCatalog(records, flags, speakers, 6), asked: [] as string[] }
})
vi.mock('virtual:catalog-home', () => ({ default: structuredClone(h.split.summary) }))
vi.mock('virtual:catalog-files', () => ({ default: h.split.files.map((_, i) => `/f${i}.json`) }))
vi.stubGlobal('fetch', async (url: string) => {
  h.asked.push(url)
  const file = h.split.files[Number(url.slice(2, -5))]
  return { ok: true, text: async () => JSON.stringify(file) }
})

import { chunkOf, HOME, ROW_POOL } from './split'
import * as catalog from './catalog'
import { upNextPlaceholder } from '../features/watch/recommendations'

const { records, split } = h
const ids = (list: readonly { id: string }[]) => list.map((v) => v.id)

describe('catalog split', () => {
  it('puts every record in the summary or one file, in order', () => {
    const { summary, files } = split
    expect(summary.total).toBe(records.length)
    const positions = [...summary.at, ...files.flatMap((f) => f.at)].sort((a, b) => a - b)
    expect(positions).toEqual(records.map((_, i) => i))
    expect(summary.categories.reduce((sum, [, , count]) => sum + count, 0)).toBe(records.length)
    // Each file parses in a few milliseconds on a slow phone.
    for (const file of files) expect(JSON.stringify(file).length).toBeLessThan(200_000)
    // A video's file is found from its id alone.
    split.files.slice(1).forEach((f, k) => {
      for (const at of f.at) expect(chunkOf(records[at].id, files.length - 1)).toBe(k + 1)
    })
  })

  it('serves the first screen from the summary, then the rest, to the same result', async () => {
    const home = () => ({
      count: catalog.videoCount(),
      featured: ids(catalog.getFeatured()),
      latest: ids(catalog.getLatest(HOME.latest)),
      categories: catalog.getCategories('latest').map((c) => [c.slug, c.name, c.count, c.cover.id]),
      bySize: catalog.getCategories().map((c) => [c.slug, c.count]),
      rows: catalog
        .getRows(ROW_POOL)
        .filter((r) => r.count >= HOME.rowMin)
        .slice(0, HOME.rows)
        .map((r) => [r.slug, r.count, ids(r.videos)]),
    })
    expect(catalog.isCatalogComplete()).toBe(false)
    expect(catalog.catalogWait('/', '')).toBeUndefined()
    expect(h.asked).toEqual([])
    const first = home()
    const featured = catalog.getFeatured()

    // A watch page asks for its own file and the pool: nothing else.
    const target = records[1500].id
    expect(catalog.getVideo(target)).toBeUndefined()
    await catalog.catalogWait(`/watch/${target}`, '')
    expect(h.asked.sort()).toEqual(['/f0.json', `/f${chunkOf(target, 6)}.json`].sort())
    expect(catalog.getVideo(target)?.id).toBe(target)
    expect(catalog.isCatalogComplete()).toBe(false)
    expect(home()).toEqual(first)
    // Its stand-in rows (the pool) are the whole catalog's.
    const sample: Video[] = [catalog.getVideo(target)!, ...featured]
    const standIns = () => sample.map((v) => ids(upNextPlaceholder(v).map((i) => i.video)))
    const partial = standIns()

    // Any other page waits for every file.
    await catalog.catalogWait('/collections', '')
    expect(catalog.isCatalogComplete()).toBe(true)
    expect(h.asked.length).toBe(split.files.length)
    expect(home()).toEqual(first)
    expect(standIns()).toEqual(partial)
    expect(ids(catalog.videos)).toEqual(records.map((r) => r.id))
    // What the first screen holds is the same objects in the whole catalog.
    expect(catalog.getFeatured()).toEqual(featured)
    expect(catalog.getVideo(featured[0].id)).toBe(featured[0])
    expect(catalog.catalogWait('/collections', '')).toBeUndefined()
  })
})
