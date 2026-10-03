import { describe, expect, it } from 'vitest'
import { seededRandom } from './seed'
import { isGenericTag, tagKey, tidyTag } from './tags'
import { embedUrl, isYouTubeId, watchUrl } from './youtube'

describe('lib helpers', () => {
  it('repeats the same random sequence for the same key', () => {
    const a = seededRandom('abc')
    const b = seededRandom('abc')
    const seq = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(seq)
    expect(seq.every((n) => n >= 0 && n < 1)).toBe(true)
    expect(seededRandom('abd')()).not.toBe(seq[0])
  })

  it('normalizes tags and spots generic ones', () => {
    expect(tagKey('Tech Tips')).toBe(tagKey('TechTips'))
    expect(isGenericTag('Video Post')).toBe(true)
    expect(isGenericTag(' video lecture ')).toBe(true)
    expect(isGenericTag('Climate Change')).toBe(false)
    expect(tidyTag('open data')).toBe('Open Data')
    expect(tidyTag('ODeL')).toBe('ODeL')
  })

  it('builds YouTube URLs only for valid ids', () => {
    expect(isYouTubeId('abcDEF12_-x')).toBe(true)
    expect(isYouTubeId('abc"><script')).toBe(false)
    expect(embedUrl('abcDEF12_-x')).toBe(
      'https://www.youtube-nocookie.com/embed/abcDEF12_-x?autoplay=1&rel=0&playsinline=1',
    )
    expect(() => embedUrl('../../evil')).toThrow()
    expect(watchUrl('a&b')).toBe('https://www.youtube.com/watch?v=a%26b')
  })
})
