import { describe, expect, it } from 'vitest'
import { setCatalog } from '../../data/testing'
import type { Profile } from '../../lib/history'
import { testVideo } from '../reel/testing'
import { titleKey, upNextFor } from './recommendations'

const profile: Profile = { watched: [], searches: [], saved: [] }
const talk = 'Public Health Preparedness Amidst Pandemic: Nursing Experience'
const clone = (id: string, title: string, publishedAt = '2024-01-01') => ({
  ...testVideo,
  id,
  youtubeId: id.padEnd(11, 'x').slice(0, 11),
  title,
  publishedAt,
})

describe('titleKey', () => {
  it('groups speaker cuts of one talk and keeps instalments apart', () => {
    expect(titleKey(`${talk} | Ms. Nelia A. Rafael, RN`)).toBe(titleKey(talk))
    expect(titleKey(`${talk} | Dr. Meg Leslie Yu`)).toBe(titleKey(`${talk} | Ms. L. Omena, RN`))
    expect(titleKey('Caring for the Special Child | Episode 5 (Part 3)')).not.toBe(
      titleKey('Caring for the Special Child | Episode 5 (Part 4)'),
    )
    expect(titleKey('FICS Chat | Episode 6: Sampling')).toBe('fics chat episode 6 sampling')
  })
})

describe('upNextFor', () => {
  it('lists one row per talk, fills from the collection and names the collection as "this"', () => {
    const cuts = ['Ms. A, RN', 'Ms. B, RN', 'Dr. C'].map((who, i) =>
      clone(`cut-${i}`, `${talk} | ${who}`),
    )
    const others = Array.from({ length: 9 }, (_, i) =>
      clone(`other-${i}`, `Lecture ${i} on data`, `2023-0${(i % 9) + 1}-01`),
    )
    setCatalog([testVideo, ...cuts, ...others])

    const items = upNextFor(testVideo, profile)
    expect(items).toHaveLength(8)
    expect(items.filter((i) => i.video.title.startsWith(talk))).toHaveLength(1)
    expect(new Set(items.map((i) => i.video.id)).size).toBe(8)
    expect(items.map((i) => i.video.id)).not.toContain(testVideo.id)
    for (const { reason } of items) expect(reason).not.toMatch(/^More from (?!this collection)/)
    // Reasons vary: never the same one on three rows in a row.
    const reasons = items.map((i) => i.reason)
    for (let i = 2; i < reasons.length; i++) {
      expect(reasons[i] === reasons[i - 1] && reasons[i] === reasons[i - 2]).toBe(false)
    }
  })

  it('skips re-uploads of the video being watched', () => {
    const copy = clone('copy', testVideo.title, '2025-01-01')
    setCatalog([testVideo, copy, clone('other', 'Another title')])
    expect(upNextFor(testVideo, profile).map((i) => i.video.id)).not.toContain('copy')
  })
})
