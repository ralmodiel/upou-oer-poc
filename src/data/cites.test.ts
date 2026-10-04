import { describe, expect, it, vi } from 'vitest'
import catalog from './catalog.json'
import shipped from './cites.json'
import { citeOf, generateCite, loadCite } from './cites'

const crawled = shipped as Record<string, string>
// the example page and its own citation (oer.upou.edu.ph/towards-the-development-of-space-humanities-in-southeast-asia/)
const SPACE = {
  id: 'towards-the-development-of-space-humanities-in-southeast-asia',
  title:
    'Towards the Development of Space Humanities in Southeast Asia: Culture and Extraterrestrial Multipolarity',
  channel: 'UP Open University',
  publishedAt: '2026-08-19T09:30:00+08:00',
  sourceUrl:
    'https://oer.upou.edu.ph/towards-the-development-of-space-humanities-in-southeast-asia/',
}
const TAIL =
  '[Video]. UPOU Networks, University of the Philippines Open University. https://oer.upou.edu.ph/towards-the-development-of-space-humanities-in-southeast-asia/'

describe('cites.json', () => {
  it('holds a non-empty citation for catalog videos only', () => {
    const ids = new Set(catalog.map((record) => record.id))
    for (const [id, cite] of Object.entries(crawled)) {
      expect(ids.has(id), id).toBe(true)
      expect(cite.trim(), id).not.toBe('')
    }
  })

  it('stays out of the catalog', () => {
    for (const record of catalog) expect(record).not.toHaveProperty('cite')
  })
})

describe('generateCite', () => {
  it("follows the site's own pattern, the channel as group author", () => {
    expect(generateCite(SPACE)).toBe(
      `UP Open University. (2026, August 19). ${SPACE.title} ${TAIL}`,
    )
  })

  it('dates by the Manila calendar and falls back to the default channel', () => {
    // 20:30 UTC on August 18 is already August 19 in Manila
    const late = { ...SPACE, channel: '', publishedAt: '2026-08-18T20:30:00Z' }
    expect(generateCite(late)).toBe(`UP Open University. (2026, August 19). ${SPACE.title} ${TAIL}`)
    expect(generateCite({ ...SPACE, channel: 'UPOU FMDS.' })).toMatch(/^UPOU FMDS\. \(2026,/)
    expect(generateCite({ ...SPACE, publishedAt: 'soon' })).toContain('(n.d.).')
  })
})

describe('loadCite and citeOf', () => {
  it('reads one citation, loading the file once', async () => {
    vi.resetModules()
    const factory = vi.fn(() => ({ default: { space: 'Cervera, F. (2026). Space [Video].' } }))
    vi.doMock('./cites.json', factory)
    const cites = await import('./cites')
    const space = { ...SPACE, id: 'space' }
    expect(cites.peekCite(space)).toBeUndefined() // nothing fetched yet
    expect(await cites.loadCite('space')).toBe('Cervera, F. (2026). Space [Video].')
    expect(cites.peekCite(space)).toEqual({
      text: 'Cervera, F. (2026). Space [Video].',
      generated: false,
    })
    expect(await cites.loadCite('elsewhere')).toBeUndefined()
    // keys inherited from Object are no citations
    expect(await cites.loadCite('constructor')).toBeUndefined()
    expect(factory).toHaveBeenCalledTimes(1)
    vi.doUnmock('./cites.json')
  })

  it('prefers the crawled citation and generates one only without it', async () => {
    const [id, cite] = Object.entries(crawled)[0] ?? []
    if (id) {
      expect(await loadCite(id)).toBe(cite)
      expect(await citeOf({ ...SPACE, id })).toEqual({ text: cite, generated: false })
    }
    expect(await citeOf({ ...SPACE, id: 'no-such-video' })).toEqual({
      text: generateCite(SPACE),
      generated: true,
    })
  })
})
