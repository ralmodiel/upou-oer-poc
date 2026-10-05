import { describe, expect, it } from 'vitest'
import { videos } from './catalog'
import records from './catalog.json'
import flags from './frame-flags.json'
import { frameFlagsOf } from './frameFlags'
import { flagsOf } from './images'
import { packCatalog, slugOfTitle, unpackRecords } from './pack'
import { isValidRecord } from './records'
import speakers from './speakers.json'
import { speakersOf } from './speakers'

const source = records as { id: string; y: string; t: string }[]

describe('catalog pack', () => {
  it('gives back every record, id included, and drops only ids the title gives', () => {
    const pack = packCatalog(source, flags, speakers)
    expect(pack.records.filter((r) => r.id === undefined).length).toBeGreaterThan(source.length / 2)
    expect(unpackRecords(structuredClone(pack))).toEqual(source)
  })

  it('keeps malformed records as they are', () => {
    const odd = [null, { id: 'x', t: 3 }, { t: 'A Title', id: 'a-title' }]
    expect(unpackRecords(packCatalog(odd, {}, {}))).toEqual(odd)
    const noId = { y: 'abcdefghijk', t: 'A Title', c: 'Science', p: '2024-01-01' }
    expect(isValidRecord(unpackRecords(packCatalog([noId], {}, {}))[0])).toBe(false)
  })

  it('slugs titles as the source site does', () => {
    expect(slugOfTitle('Women’s Month 2024 – ASEAN+3 & Café')).toBe('womens-month-2024-asean3-cafe')
  })

  it('serves the app the same catalog, frame flags and speakers as the source files', () => {
    expect(videos.map((v) => v.id)).toEqual(source.map((r) => r.id))
    const named = speakers as Record<string, string[]>
    for (const { y } of source) {
      expect(frameFlagsOf(y), y).toBe(flagsOf((flags as Record<string, unknown>)[y]))
      expect(speakersOf(y), y).toEqual(named[y] ?? [])
    }
  })
})
