import { describe, expect, it } from 'vitest'
import type { Video } from '../types'
import { normalizeText, stem, termWeightsOf, tokenize } from './text'

const video = (over: Partial<Video>): Video => ({
  id: 'v',
  youtubeId: 'abcdefghijk',
  title: '',
  description: '',
  category: 'Misc',
  tags: [],
  channel: 'UP Open University',
  publishedAt: '2026-01-01',
  sourceUrl: '',
  thumbnail: '',
  backdrop: '',
  frames: [],
  ...over,
})

describe('tokenize', () => {
  it('drops English and Filipino function words, numbering and bare numbers', () => {
    expect(tokenize('The Role of the Teacher in 2024')).toEqual(['role', 'teacher'])
    expect(tokenize('Ano ang mga karapatan ng mga bata?')).toEqual(['karapatan', 'bata'])
    expect(tokenize('Part 2: Episode 7 (Session 3)')).toEqual([])
  })

  it('strips diacritics, apostrophes and honorifics', () => {
    expect(normalizeText('Niña’s Café')).toBe('ninas cafe')
    expect(tokenize('La Niña | Dr. José Añonuevo')).toEqual(['la', 'nina', 'jose', 'anonuevo'])
    expect(tokenize("Alzheimer's Café")).toEqual(['alzheimer', 'cafe'])
  })

  it('stems English plurals and -ing/-ed but leaves short words alone', () => {
    const words = ['policies', 'classes', 'videos', 'analysis', 'teaching', 'planning', 'learned']
    expect(words.map(stem)).toEqual([
      'policy',
      'class',
      'video',
      'analysis',
      'teach',
      'plan',
      'learn',
    ])
    expect(['bus', 'being', 'coding', 'based'].map(stem)).toEqual([
      'bus',
      'being',
      'coding',
      'based',
    ])
    expect(tokenize('Mga Kuwento ng Kababaihan')).toEqual(['kuwento', 'kababaihan'])
  })

  it('adds bigrams within a phrase only', () => {
    expect(tokenize('Climate Change: La Niña', { bigrams: true })).toEqual([
      'climate',
      'change',
      'climate change',
      'la',
      'nina',
      'la nina',
    ])
    expect(tokenize('COVID-19 vaccines', { bigrams: true })).toEqual([
      'covid',
      'vaccine',
      'covid vaccine',
    ])
  })
})

describe('termWeightsOf', () => {
  it('weights title over tags over category and skips generic tags and General', () => {
    const w = termWeightsOf(
      video({
        title: 'Teaching Online',
        tags: ['Video Post', 'Pedagogy'],
        category: 'Education',
        channel: 'TVUP',
      }),
    )
    expect(w.get('teach')).toBe(3)
    expect(w.get('teach online')).toBe(1.5)
    expect(w.get('pedagogy')).toBe(2)
    expect(w.get('education')).toBe(1.5)
    expect(w.get('tvup')).toBe(0.5)
    expect(w.has('video')).toBe(false)
    expect(termWeightsOf(video({ title: 'Town hall', category: 'General' })).has('general')).toBe(
      false,
    )
  })

  it('caps a term repeated across fields', () => {
    const v = video({
      title: 'FASTLearn Episode 1',
      tags: ['FASTLearn', 'FASTLearn Series 1', 'FASTLearn Episode 1'],
    })
    expect(termWeightsOf(v).get('fastlearn')).toBe(4.5)
  })

  it('keeps a long transcript from outweighing the metadata', () => {
    const transcript = Array.from({ length: 10_000 }, (_, i) => `word${i % 500}`)
    const w = termWeightsOf(video({ title: 'Short Title' }), transcript)
    let meta = 0
    let spoken = 0
    for (const [t, x] of w) if (t.startsWith('word')) spoken += x
    for (const [t, x] of w) if (!t.startsWith('word')) meta += x
    expect(spoken).toBeCloseTo(meta)
    expect([...w.keys()].filter((t) => t.startsWith('word'))).toHaveLength(300)
    expect(w.get('short')).toBe(3)
  })
})
