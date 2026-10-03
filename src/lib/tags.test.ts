import { describe, expect, it } from 'vitest'
import {
  isGenericTag,
  isOrgTag,
  POPULAR_SERIES,
  POPULAR_TOPICS,
  tagKey,
  tidyTag,
  topicTags,
} from './tags'

describe('tags', () => {
  it('drops housekeeping, brand, numeric and tiny tags', () => {
    const junk = ['Past Post', 'up open university', 'upou', 'TVUP', 'Video Post', 'eLearning']
    for (const tag of [...junk, '2020', 'DE', 'Open']) expect(isGenericTag(tag), tag).toBe(true)
    for (const tag of ['ODeL', 'gender', 'Climate Change', 'FMDS']) {
      expect(isGenericTag(tag), tag).toBe(false)
    }
  })

  it('knows faculties, sponsors and people are not topics', () => {
    expect(isOrgTag('FMDS')).toBe(true)
    expect(isOrgTag('Dr. Melinda dP. Bandalaria')).toBe(true)
    expect(isOrgTag('agriculture')).toBe(false)
  })

  it("turns a video's tags into tidy, de-duplicated chips", () => {
    expect(
      topicTags(['eLearning', 'open data', 'Open Data', 'upou', 'ASEAN', ' gender '], 2),
    ).toEqual(['Open Data', 'ASEAN'])
    expect(tagKey('Tech Tips')).toBe(tagKey('TechTips'))
    expect(tidyTag('TechTips')).toBe('TechTips')
  })

  it('curates topics and series that are not junk', () => {
    expect(POPULAR_TOPICS.length).toBeGreaterThanOrEqual(12)
    const all = [...POPULAR_TOPICS, ...POPULAR_SERIES]
    expect(new Set(all.map(tagKey)).size).toBe(all.length)
    for (const topic of all) expect(isGenericTag(topic), topic).toBe(false)
  })
})
