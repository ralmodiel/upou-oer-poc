import type { Video } from '../types'

const make = (
  id: string,
  title: string,
  category: string,
  tags: string[],
  publishedAt: string,
  featured = false,
): Video => ({
  id,
  youtubeId: 'abcdefghijk',
  title,
  description: `About ${title}.`,
  category,
  tags,
  channel: 'UP Open University',
  publishedAt,
  sourceUrl: `https://oer.upou.edu.ph/${id}/`,
  thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  backdrop: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  frames: [],
  featured,
})

/** Small catalog used by tests in place of src/data/videos.json. */
export const fixtureVideos: Video[] = [
  make(
    'climate-basics',
    'Climate Change Basics',
    'Research',
    ['Climate', 'Science'],
    '2026-05-01T08:00:00+08:00',
    true,
  ),
  make(
    'climate-policy',
    'Climate Policy in the Philippines',
    'Research',
    ['climate', 'Policy'],
    '2026-04-01T08:00:00+08:00',
  ),
  make('ocean-science', 'Ocean Science 101', 'Research', ['Science'], '2026-03-01T08:00:00+08:00'),
  make(
    'digital-art',
    'Digital Art Studio',
    'Arts and Multimedia',
    ['Art'],
    '2026-02-01T08:00:00+08:00',
  ),
  make(
    'film-making',
    'Film Making for Beginners',
    'Arts and Multimedia',
    ['Film'],
    '2026-01-01T08:00:00+08:00',
  ),
  make(
    'animation',
    'Animation Workshop',
    'Arts and Multimedia',
    ['Art', 'Film'],
    '2025-12-01T08:00:00+08:00',
  ),
  make('odel-intro', 'Introduction to ODeL', 'Education', ['ODeL'], '2025-11-01T08:00:00+08:00'),
]
