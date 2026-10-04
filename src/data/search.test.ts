import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
import { buildVocabulary } from '../lib/fuzzy'
import type { Video } from '../types'
import { searchCatalog, searchVideos, videos, warmSearch } from './catalog'
import { setCatalog } from './testing'

// Spies on the fuzzy module, keeping its behaviour, to count vocabulary builds.
vi.mock('../lib/fuzzy', { spy: true })

const shipped = videos
afterEach(() => setCatalog(fixtureVideos))

const video = (id: string, over: Partial<Video>): Video => ({
  ...fixtureVideos[2],
  id,
  tags: [],
  description: '',
  ...over,
})

describe('searchCatalog', () => {
  it('builds the spelling vocabulary once, and only when a search needs it', () => {
    setCatalog(fixtureVideos)
    vi.mocked(buildVocabulary).mockClear()
    // Words common as typed need no near spellings.
    expect(searchVideos('science')).toHaveLength(3)
    expect(buildVocabulary).not.toHaveBeenCalled()
    expect(searchVideos('scince')).toHaveLength(3)
    expect(searchVideos('climte')).toHaveLength(2)
    warmSearch()
    expect(buildVocabulary).toHaveBeenCalledTimes(1)
    // A new catalog starts over.
    setCatalog(fixtureVideos)
    warmSearch()
    expect(buildVocabulary).toHaveBeenCalledTimes(2)
  })

  it('ranks whole words over word starts, parts of words and near spellings', () => {
    setCatalog([
      video('part', { title: 'Malnutrition Today' }),
      video('tag', { title: 'Food Talk', tags: ['Nutrition'] }),
      video('prefix', { title: 'Nutritional Science' }),
      video('exact', { title: 'Nutrition Basics' }),
    ])
    expect(searchVideos('nutrition').map((v) => v.id)).toEqual(['exact', 'prefix', 'part', 'tag'])
    const typo = searchCatalog('nutritoin')
    expect(typo.videos.map((v) => v.id)).toEqual(['exact', 'tag'])
    expect(typo.exact).toBe(0)
    expect(typo.correction).toBe('nutrition')
  })

  it('keeps every word required, each one allowed a near spelling', () => {
    setCatalog(fixtureVideos)
    expect(searchVideos('climte chnge').map((v) => v.id)).toEqual(['climate-basics'])
    expect(searchCatalog('climte chnge').correction).toBe('climate change')
    expect(searchVideos('climte zzzz')).toEqual([])
  })

  it('never fixes words of three letters or fewer', () => {
    setCatalog(fixtureVideos)
    expect(searchCatalog('arx')).toEqual({ videos: [], exact: 0, correction: undefined })
    expect(searchCatalog('artz').videos.length).toBeGreaterThan(0)
  })

  it("never suggests people's names", () => {
    setCatalog([...fixtureVideos, video('talk', { title: 'A Talk', tags: ['Dr. Myra Oruga'] })])
    expect(searchVideos('oruga').map((v) => v.id)).toEqual(['talk'])
    expect(searchCatalog('orugo')).toMatchObject({ videos: [], correction: undefined })
  })

  it('finds the videos a review found missing in the shipped catalog', () => {
    setCatalog(shipped)
    for (const [typed, fixed] of [
      ['nutritoin', 'nutrition'],
      ['gendr', 'gender'],
      ['mental helth', 'mental health'],
      ['climte change', 'climate change'],
    ]) {
      const found = searchCatalog(typed)
      expect(found.correction).toBe(fixed)
      expect(found.exact).toBe(0)
      expect(found.videos.length).toBeGreaterThan(2)
      expect(searchCatalog(fixed).exact).toBeGreaterThan(2)
    }
  })
})
