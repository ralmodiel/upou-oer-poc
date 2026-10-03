import type { Video } from '../../types'

const still = (name: string) => `https://i.ytimg.com/vi/abcDEF12345/${name}.jpg`

/** Test fixture shaped like a crawled video. */
export const testVideo: Video = {
  id: 'intro-to-data-science',
  youtubeId: 'abcDEF12345',
  title: 'Introduction to Data Science',
  description: 'Learn how raw numbers become insight. We cover the basics of open data.',
  category: 'Technology and Teaching',
  tags: ['Video Post', 'statistics', 'Open Data', 'TechTips', 'TechTips Series 1'],
  channel: 'UP Open University',
  publishedAt: '2025-05-10T08:00:00+08:00',
  sourceUrl: 'https://oer.upou.edu.ph/intro-to-data-science/',
  thumbnail: still('mqdefault'),
  thumbnails: ['mqdefault', 'mq1', 'mq2', 'mq3'].map(still),
  backdrop: still('maxresdefault'),
  frames: ['maxres1', 'maxres2', 'maxres3'].map(still),
}
