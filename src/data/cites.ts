// How to cite a video. The source page's own "How to cite" text when it has one (cites.json,
// written by scripts/crawl.mjs, verbatim); otherwise one generated from the video's details in
// the site's pattern. cites.json stays out of the catalog (which every page loads): it is a chunk
// of its own, fetched the first time a watch page or quick look asks.
import type { Video } from '../types'
import { DEFAULT_CHANNEL } from './expand'

type Cites = Record<string, string>
export interface Citation {
  text: string
  /** True when built from the video's details: the source page has no citation. */
  generated: boolean
}
type CiteFields = Pick<Video, 'id' | 'title' | 'channel' | 'publishedAt' | 'sourceUrl'>

let cites: Promise<Cites> | undefined
let table: Cites | undefined

const citeIn = (all: Cites, id: string) => (Object.hasOwn(all, id) ? all[id] : undefined)

/** A video's crawled citation, or undefined when its page has none. A failed fetch is retried. */
export function loadCite(id: string): Promise<string | undefined> {
  cites ??= import('./cites.json').then(
    (module) => (table = module.default as Cites),
    (err: unknown) => {
      cites = undefined
      throw err
    },
  )
  return cites.then((all) => citeIn(all, id))
}

// The publisher's calendar day, as the site's own citations give it: "2026, August 19".
const DAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/**
 * The site's pattern with the channel as group author: "UP Open University. (2026, August 19).
 * Title [Video]. UPOU Networks, University of the Philippines Open University. https://…/".
 */
export function generateCite(video: CiteFields): string {
  const author = (video.channel.trim() || DEFAULT_CHANNEL).replace(/\.$/, '')
  const date = new Date(video.publishedAt)
  const parts = Number.isNaN(date.getTime())
    ? null
    : Object.fromEntries(DAY.formatToParts(date).map((part) => [part.type, part.value]))
  const when = parts ? `${parts.year}, ${parts.month} ${parts.day}` : 'n.d.'
  return `${author}. (${when}). ${video.title} [Video]. UPOU Networks, University of the Philippines Open University. ${video.sourceUrl}`
}

const citationOf = (video: CiteFields, crawled: string | undefined): Citation =>
  crawled ? { text: crawled, generated: false } : { text: generateCite(video), generated: true }

/** The citation to show. If cites.json cannot load (offline), the generated one, so labelled. */
export const citeOf = (video: CiteFields): Promise<Citation> =>
  loadCite(video.id).then(
    (crawled) => citationOf(video, crawled),
    () => citationOf(video, undefined),
  )

/** The citation right away once cites.json is in (no empty first paint); undefined before. */
export const peekCite = (video: CiteFields): Citation | undefined =>
  table && citationOf(video, citeIn(table, video.id))
