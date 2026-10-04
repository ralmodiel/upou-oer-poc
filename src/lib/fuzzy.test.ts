import { describe, expect, it } from 'vitest'
import {
  buildVocabulary,
  correctionOf,
  editDistance,
  EXACT,
  matchTier,
  maxEdits,
  NEAR,
  nearWords,
  PART,
  PREFIX,
  wordsOf,
} from './fuzzy'

describe('editDistance', () => {
  it('counts a swap of neighbours as one edit, like an insert, delete or replace', () => {
    expect(editDistance('nutritoin', 'nutrition')).toBe(1)
    expect(editDistance('gendr', 'gender')).toBe(1)
    expect(editDistance('helth', 'health')).toBe(1)
    expect(editDistance('climte', 'climate')).toBe(1)
    expect(editDistance('cat', 'cut')).toBe(1)
    expect(editDistance('same', 'same')).toBe(0)
    expect(editDistance('', 'abc')).toBe(3)
  })

  it('stops once past the bound', () => {
    expect(editDistance('kitten', 'sitting', 1)).toBe(2)
    expect(editDistance('a', 'abcdef', 2)).toBe(3)
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })
})

describe('nearWords', () => {
  const vocabulary = buildVocabulary(
    [
      wordsOf('Nutrition and Health'),
      wordsOf('Mental Health'),
      wordsOf('Gender and Development'),
      wordsOf('Art, Arts and Culture'),
    ],
    (word) => word === 'culture',
  )

  it('allows one edit from 4 letters and two from 8, none for shorter words', () => {
    expect(maxEdits('art')).toBe(0)
    expect(maxEdits('arts')).toBe(1)
    expect(maxEdits('nutritio')).toBe(2)
    expect(nearWords(vocabulary, 'arx')).toEqual([])
    expect(nearWords(vocabulary, 'artz').map((n) => n.word)).toEqual(['art', 'arts'])
    expect(nearWords(vocabulary, 'nutritoin').map((n) => n.word)).toEqual(['nutrition'])
  })

  it('puts the fewest edits first, then the most used word', () => {
    expect(nearWords(vocabulary, 'helth')).toEqual([{ word: 'health', edits: 1, count: 2 }])
    expect(nearWords(vocabulary, 'gendr').map((n) => n.word)).toEqual(['gender'])
  })

  it('leaves out skipped words and the word itself', () => {
    expect(nearWords(vocabulary, 'cultures')).toEqual([])
    expect(nearWords(vocabulary, 'health')).toEqual([])
  })
})

describe('matchTier', () => {
  const field = wordsOf('Climate Change: An Introduction to Nutritional Science')

  it('ranks a whole word over a word start, a part of a word and a near spelling', () => {
    expect(matchTier(field, { word: 'climate', near: [] })).toBe(EXACT)
    expect(matchTier(field, { word: 'nutrition', near: [] })).toBe(PREFIX)
    expect(matchTier(field, { word: 'troduct', near: [] })).toBe(PART)
    expect(matchTier(field, { word: 'climte', near: ['climate'] })).toBe(NEAR)
    // A near spelling counts only as a whole word.
    expect(matchTier(field, { word: 'nutritoin', near: ['nutrition'] })).toBe(0)
  })
})

describe('correctionOf', () => {
  it('swaps each misspelt word for its likeliest near spelling', () => {
    expect(
      correctionOf([
        { word: 'mental', near: [] },
        { word: 'helth', near: ['health', 'helath'] },
      ]),
    ).toBe('mental health')
    expect(correctionOf([{ word: 'mental', near: [] }])).toBeUndefined()
  })
})
