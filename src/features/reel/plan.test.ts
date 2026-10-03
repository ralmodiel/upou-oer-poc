import { describe, expect, it } from 'vitest'
import { clampTitle, hookFrom, toLines, topicsOf } from './plan'
import { testVideo } from './testing'

describe('clampTitle', () => {
  it('keeps short titles and cuts long ones at a word boundary with an ellipsis', () => {
    expect(clampTitle('  Types  of Models ')).toBe('Types of Models')
    const long = clampTitle('alpha beta gamma delta '.repeat(20), 50)
    expect(long.length).toBeLessThanOrEqual(50)
    expect(long).toMatch(/^alpha beta gamma delta .* [a-z]+…$/)
  })
})

describe('hookFrom', () => {
  it('drops links and "In this video," and keeps abbreviations inside the hook', () => {
    expect(hookFrom('In this video, we explore https://example.com open data. More here.')).toBe(
      'We explore open data. More here.',
    )
    expect(hookFrom('Dr. Cruz explains it. Then more.')).toBe('Dr. Cruz explains it. Then more.')
    expect(hookFrom('   ')).toBe('')
  })

  it('ellipsizes long text at a word boundary', () => {
    const hook = hookFrom('word '.repeat(60))
    expect(hook.length).toBeLessThanOrEqual(110)
    expect(hook).toMatch(/ word…$/)
  })
})

describe('topicsOf', () => {
  it('skips generic tags, the category and series variants, shortest first', () => {
    const tags = [...testVideo.tags, 'Lecture', 'technology and teaching']
    expect(topicsOf({ ...testVideo, tags })).toEqual(['TechTips', 'Open Data', 'Statistics'])
  })
})

describe('toLines', () => {
  it('balances words across lines and respects the line cap', () => {
    expect(toLines(['Introduction', 'to', 'Data', 'Science'])).toEqual([
      ['Introduction', 'to'],
      ['Data', 'Science'],
    ])
    expect(toLines(['Solo'])).toEqual([['Solo']])
    const words = 'one two three four five six seven eight nine ten eleven twelve'.split(' ')
    expect(toLines(words, 4)).toHaveLength(4)
    expect(toLines(words, 7).flat()).toEqual(words)
  })
})
