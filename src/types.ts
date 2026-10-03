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
  /** 320px set: the small `poster` first, then the small versions of the three reel `frames`. */
  thumbnails?: string[]
  /** 16:9, >= 1280px wide when available; matches `thumbnail` for hi-res videos. */
  backdrop: string
  /** Canonical large image (hero slots, player poster, reel end card): the original unless flagged. */
  poster?: string
  /** The video's own large image (og:image or YouTube default), flagged or not: link previews. */
  original?: string
  /** Three 16:9 still frames from the video for the promo reel; none when YouTube has none. */
  frames: string[]
  /** Per `frames` entry: a slide (text on a flat background, no face); absent when none is. */
  slides?: boolean[]
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
  /** 0 when YouTube has no still frames at all (mq1–mq3 missing): only the thumbnail exists. */
  q?: 0
  /** Backdrop URL (og:image or maxresdefault) when it is not the YouTube default for `m`. */
  b?: string
  /** Channel, only when it is not "UP Open University". */
  ch?: string
}
