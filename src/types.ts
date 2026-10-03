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
  /** 16:9, ~320px wide. */
  thumbnail: string
  /** 16:9, >= 1280px wide. */
  backdrop: string
  /** Three 16:9 still frames from the video, used by the promo reel. */
  frames: string[]
  featured?: boolean
}

/** Slim record stored in src/data/catalog.json; expandRecord() derives the Video from it. */
export interface CatalogRecord {
  /** UPOU Networks post slug, unique. */
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
  /** 0 when YouTube has no maxres still frames: use mq1..3 (and mqdefault as the backdrop). */
  m?: 0
  /** Backdrop URL (og:image or maxresdefault) when it is not the YouTube default for `m`. */
  b?: string
  /** Channel, only when it is not "UP Open University". */
  ch?: string
}
