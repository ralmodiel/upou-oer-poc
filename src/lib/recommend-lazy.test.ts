import { describe, expect, it } from 'vitest'
import { loadRecommender, prefetchRecommender } from './recommend-lazy'
import * as recommend from './recommend'

describe('loadRecommender', () => {
  it('resolves to the recommender module and shares one promise', async () => {
    const first = loadRecommender()
    expect(loadRecommender()).toBe(first)
    expect(await first).toBe(recommend)
    expect(() => prefetchRecommender()).not.toThrow()
  })
})
