import { describe, expect, it } from 'vitest'
import { isGenericTag, personKey } from '../lib/tags'
import { getVideo } from './catalog'
import table from './speakers.json'
import { speakersOf } from './speakers'

const entries = Object.entries(table as Record<string, string[]>)

describe('speakers', () => {
  it('names catalog videos only, each speaker once, and none for the rest', () => {
    expect(entries.length).toBeGreaterThan(100)
    for (const [id, names] of entries) {
      expect(getVideo(id), id).toBeDefined()
      expect(names.length, id).toBeGreaterThan(0)
      expect(new Set(names.map(personKey)).size, id).toBe(names.length)
    }
    expect(speakersOf('no-such-video')).toEqual([])
  })

  it("never shows a video's own speakers among its topics", () => {
    for (const [id, names] of entries) {
      const keys = new Set(names.map(personKey))
      for (const tag of getVideo(id)?.tags ?? [])
        if (keys.has(personKey(tag))) expect(isGenericTag(tag), `${id}: ${tag}`).toBe(true)
    }
  })
})
