import catalogNames from 'virtual:catalog-names'
import { describe, expect, it } from 'vitest'
import records from '../data/catalog.json'
import { isValidRecord } from '../data/records'
import {
  isAcronymOf,
  isGenericTag,
  isOrgTag,
  isPersonTag,
  learnedNamesOf,
  personKey,
  POPULAR_SERIES,
  POPULAR_TOPICS,
  registerNameTokens,
  registerSpeakers,
  tagKey,
  tidyTag,
  topicTags,
  type LearnedNames,
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

describe('tidyTag', () => {
  it('fixes case: acronyms, small words, lowercase and shouting tags', () => {
    expect(tidyTag('asean studies')).toBe('ASEAN Studies')
    expect(tidyTag('Ched')).toBe('CHED')
    expect(tidyTag('Health And Wellbeing')).toBe('Health and Wellbeing')
    expect(tidyTag('ugnayan ng pahinungod')).toBe('Ugnayan ng Pahinungod')
    expect(tidyTag('MORAL RESPONSIBILITY IN A CHANGING WORLD')).toBe(
      'Moral Responsibility in a Changing World',
    )
    expect(tidyTag('covid19')).toBe('COVID-19')
    expect(tidyTag('Vitamin A')).toBe('Vitamin A')
    expect(tidyTag('WILLS 2024')).toBe('WILLS 2024')
  })

  it('merges spellings and full names with their short tag', () => {
    expect(
      topicTags(['COVID19', 'Covid-19', 'FMDS', 'Faculty of Management and Development Studies']),
    ).toEqual(['COVID-19', 'FMDS'])
  })
})

describe('isAcronymOf', () => {
  it('matches the starts of the words in order, skipping small words, whatever the case', () => {
    expect(isAcronymOf('ASEM', 'Asia-Europe Meeting')).toBe(true)
    expect(isAcronymOf('DepEd', 'Department of Education')).toBe(true)
    expect(isAcronymOf('CHED', 'Commission on Higher Education')).toBe(true)
    expect(isAcronymOf('ODeL', 'open and distance eLearning')).toBe(true)
    expect(isAcronymOf('MOOC', 'Massive Open Online Course')).toBe(true)
  })

  it('needs a written acronym and every main word', () => {
    expect(isAcronymOf('Data', 'Data Analytics')).toBe(false)
    expect(isAcronymOf('AM', 'Asia-Europe Meeting')).toBe(false)
    expect(isAcronymOf('ASEM', 'Asia')).toBe(false)
    expect(isAcronymOf('ICT', 'Climate Change')).toBe(false)
  })
})

describe('names learned by the build', () => {
  it('are what the browser would learn from the catalog, and answer the same', () => {
    const docs = (records as unknown[])
      .filter(isValidRecord)
      .map((r) => ({ tags: r.g ?? [], title: r.t }))
    const sorted = (n: LearnedNames) =>
      [n.firstNames, n.nameTokens, n.surnameTags].map((l) => [...l].sort())
    expect(sorted(catalogNames)).toEqual(sorted(learnedNamesOf(docs)))
    expect(catalogNames.nameTokens.length).toBeGreaterThan(100)

    const tags = [...new Set(docs.flatMap((d) => d.tags))]
    registerNameTokens(() => docs)
    const learned = tags.map(isPersonTag)
    registerNameTokens(catalogNames)
    expect(tags.map(isPersonTag)).toEqual(learned)
    registerNameTokens([])
  })
})

describe('speakers are never topics', () => {
  it('knows a person however the tag writes them', () => {
    const key = personKey('Felipe Cervera')
    for (const name of [
      'Dr. Felipe M. Cervera',
      'FelipeCervera',
      'DrFelipeCervera',
      'felipe cervera',
    ])
      expect(personKey(name), name).toBe(key)
    expect(personKey('H.E. Elizabeth Buensuceso')).toBe(personKey('Elizabeth Buensuceso'))
    for (const tag of ['H.E. Elizabeth Buensuceso', 'Prop. Hadji Balajadia', 'Mx. Cheche Payos'])
      expect(isPersonTag(tag), tag).toBe(true)
  })

  it("drops a speaker's name from the chips, joined, titled or plain", () => {
    registerSpeakers(['Dr. Felipe M. Cervera', 'Prof. Alipio T. Garcia'])
    const tags = ['FelipeCervera', 'DrFelipeCervera', 'felipe cervera', 'Alipio Garcia']
    expect(topicTags([...tags, 'Space Humanities', 'Physics'])).toEqual([
      'Space Humanities',
      'Physics',
    ])
    for (const tag of tags) expect(isOrgTag(tag), tag).toBe(true)
    registerSpeakers([])
  })

  it('keeps joined topics that are not names', () => {
    for (const tag of ['FASTLearn', 'MicroLearning', 'TechTips', 'LearnFastWithUs', 'ASEANnale'])
      expect(isGenericTag(tag), tag).toBe(false)
  })
})
