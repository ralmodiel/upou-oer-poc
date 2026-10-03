/** One video in the catalog, expanded from a CatalogRecord by src/data/expand.ts. */
export interface Video {
  id: string
  youtubeId: string
  title: string
  description: string
  category: string
  tags: string[]
  channel: string
  publishedAt: string
  sourceUrl: string
  /** 16:9, ~320px wide; the member of `thumbnails` shown during this page load. */
  thumbnail: string
  /** All thumbnail candidates (320px): the original first, then the three still frames. */
  thumbnails?: string[]
  /** 16:9, >= 1280px wide when available; matches `thumbnail` for hi-res videos. */
  backdrop: string
  /** Three 16:9 still frames from the video, used by the promo reel. */
  frames: string[]
  featured?: boolean
}

/** Slim record stored in src/data/catalog.json; expandRecord() derives the Video from it. */
export interface CatalogRecord {
  /** UPOU OER post slug, unique. */
  id: string
  /** YouTube id. */
  y: string
  /** Title. */
  t: string
  /** Category name. */
  c: string
  /** Published at, ISO 8601. */
  p: string
  /** Description, omitted when empty. */
  d?: string
  /** Tags, omitted when empty. */
  g?: string[]
  /** Featured on the source site. */
  f?: 1
  /** 0 when YouTube has no 1280px still frames: use the 640px sd stills. */
  m?: 0
  /** 0 when the 640px sd stills are missing as well: only the 320px mq images exist. */
  s?: 0
  /** Backdrop URL (og:image or maxresdefault) when it is not the YouTube default for `m`. */
  b?: string
  /** Channel, only when it is not "UP Open University". */
  ch?: string
}
