import { afterEach, describe, expect, it } from 'vitest'
import { setCatalog } from '../data/testing'
import { fixtureVideos, manyVideos } from './test-fixtures'
import { toneOf } from './tones'

afterEach(() => setCatalog(fixtureVideos))

describe('toneOf', () => {
  it('gives neighbouring collections different brand tones, in catalog order', () => {
    setCatalog(
      ['A', 'B', 'C', 'D', 'E'].flatMap((name, i) =>
        manyVideos(6 - i, `Subject ${name}`).map((v) => ({ ...v, id: `${v.id}-${name}` })),
      ),
    )
    expect(['a', 'b', 'c', 'd', 'e'].map((x) => toneOf(`subject-${x}`))).toEqual([
      'maroon',
      'forest',
      'gold',
      'charcoal',
      'maroon',
    ])
  })

  it('falls back to maroon for an unknown collection', () => {
    expect(toneOf('nope')).toBe('maroon')
  })
})
