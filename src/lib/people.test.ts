import { beforeAll, describe, expect, it } from 'vitest'
import { isGenericTag, isNameToken, isPersonTag, registerNameTokens, topicTags } from './tags'

describe('person tags', () => {
  beforeAll(() =>
    registerNameTokens(['Dr. Myra Oruga', 'aProf. Benjamin Gonzales', 'Ms. Nally Rapada']),
  )

  it('recognises titled, suffixed and initialled names', () => {
    for (const tag of [
      'Dr. Myra Oruga',
      'aProf. Benjamin Gonzales',
      'Ms. Nally Rapada',
      'Atty. Jose Rizal',
      'Juan dela Cruz Jr.',
      'Maricel A. Tapia-Villamayor',
      'Sir Lex Librero',
    ])
      expect(isPersonTag(tag), tag).toBe(true)
  })

  it('recognises learned names without a title', () => {
    expect(isPersonTag('Myra Oruga')).toBe(true)
    expect(isPersonTag('Benjamin Gonzales')).toBe(true)
  })

  it('keeps topics and places', () => {
    for (const tag of [
      'Climate Change',
      'Cagayan Valley',
      'Public Health',
      'Sikolohiyang Pilipino',
      'Open Education',
      'FASTLearn',
      'Region II',
      'Module III',
    ])
      expect(isPersonTag(tag), tag).toBe(false)
  })

  it('drops people from topic chips everywhere', () => {
    expect(isGenericTag('Dr. Myra Oruga')).toBe(true)
    expect(topicTags(['Climate Change', 'Dr. Myra Oruga', 'Myra Oruga', 'Research'])).toEqual([
      'Climate Change',
      'Research',
    ])
  })
})

describe('learned name tokens', () => {
  beforeAll(() =>
    registerNameTokens([
      'Dr. Ma. Cristina D. Padolina',
      'Mr. Noel Rosal,',
      'Director Multi Media Center and Information Service UP Open University',
    ]),
  )

  it('knows first and last names, whatever their case or punctuation', () => {
    for (const word of ['Padolina', 'cristina', 'Rosal', 'noel'])
      expect(isNameToken(word), word).toBe(true)
    expect(isPersonTag('Ma. Cristina Padolina')).toBe(true)
  })

  it('learns nothing from a titled office', () => {
    for (const word of ['media', 'information', 'open', 'university']) {
      expect(isNameToken(word), word).toBe(false)
    }
    expect(isPersonTag('Open University')).toBe(false)
  })
})
