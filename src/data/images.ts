// Which YouTube images a video shows, given its frame flags. Pure (no catalog, no JSON import), so
// tools/seo/catalog.mjs builds the static pages from the same choices as the app.
import type { CatalogRecord, Video } from '../types'

const image = (youtubeId: string, name: string) => `https://i.ytimg.com/vi/${youtubeId}/${name}.jpg`

// Decoders of a frame-flags value; the bit layout is documented in frameFlags.ts. Candidate 0 is
// YouTube's thumbnail, 1-3 its stills.

/** A frame-flags value as a non-negative integer; anything else reads 0 (nothing known). */
export const flagsOf = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0

/** Bits 0-3: the flagged candidates. */
export const maskOf = (value: unknown): number => flagsOf(value) & 0b1111

/** Candidate index of an image URL: YouTube's stills are 1-3, its thumbnail or a source image 0. */
export const candidateOf = (src: string): number =>
  Number(/\/(?:maxres|sd|hq|mq)([1-3])\.jpg(\?|$)/.exec(src)?.[1] ?? 0)

/** Whether the frame filter passes this image of a video with these flags. */
export const isCleanImage = (value: unknown, src: string): boolean =>
  !(maskOf(value) & (1 << candidateOf(src)))

/** Bits 4-5: the least bad candidate, when all four are flagged (else 0). */
export const fallbackOf = (value: unknown): number =>
  maskOf(value) === 0b1111 ? (flagsOf(value) >> 4) & 0b11 : 0

const PAIRS: readonly (readonly [number, number])[] = [
  [1, 2],
  [1, 3],
  [2, 3],
]

/** Bits 6-8: pairs of stills that show the same shot. */
export const duplicatePairsOf = (value: unknown): (readonly [number, number])[] =>
  PAIRS.filter((_, k) => flagsOf(value) & (1 << (6 + k)))

/** Bits 9-12: the slide-like candidates (text on a flat background, no face). */
export const slideBitsOf = (value: unknown): number => (flagsOf(value) >> 9) & 0b1111

/** Bits 13-16: the beautiful candidates (unflagged and well scored). */
export const beautyBitsOf = (value: unknown): number => (flagsOf(value) >> 13) & 0b1111

/** Bits 17-24: the candidates best first, or undefined when the video was not ranked. */
export function rankingOf(value: unknown): number[] | undefined {
  const bits = (flagsOf(value) >> 17) & 0xff
  const order = [0, 1, 2, 3].map((place) => (bits >> (2 * place)) & 0b11)
  return bits && new Set(order).size === 4 ? order : undefined
}

/** A box in fractions of the frame: [x0, y0, x1, y1]. */
export type Box = [number, number, number, number]

/** Bits 25-41: what a move on the reel's one still keeps in view (in 16ths), if anything. */
export function keepOf(value: unknown): Box | undefined {
  // Past bit 31: read with arithmetic, then the 17 bits with bitwise operators.
  const bits = Math.floor(flagsOf(value) / 2 ** 25)
  if (!(bits & 1)) return undefined
  const at = (shift: number) => (bits >>> (1 + shift)) & 15
  return [at(0) / 16, at(4) / 16, (at(8) + 1) / 16, (at(12) + 1) / 16]
}

const YOUTUBE_IMAGE = /^https:\/\/i\.ytimg\.com\/vi\/([\w-]{11})\//
// YouTube's 480px and 640px stills are 4:3 (letterboxed); its 320px and 1280px ones are 16:9.
const NARROW = /\/(?:hq|sd)(?:default|[1-3])\.jpg(\?|$)/

/** The video id in a YouTube image URL; null for anything else (a source-site og:image). */
export const youtubeIdOf = (src: string): string | null => YOUTUBE_IMAGE.exec(src)?.[1] ?? null

/**
 * The zoom that pushes black bars baked into a YouTube image out of a 16:9 slot (1 when none),
 * from the video's frame-crops.json entry: per candidate one zoom for every size, or a pair for
 * the 16:9 sizes and the 4:3 ones (a 4:3 video's 320px stills add a pillarbox of their own).
 */
export function zoomFrom(entry: unknown, src: string): number {
  const crop: unknown = Array.isArray(entry) ? entry[candidateOf(src)] : undefined
  const zoom: unknown = Array.isArray(crop) ? crop[NARROW.test(src) ? 1 : 0] : crop
  return typeof zoom === 'number' && zoom > 1 && zoom < 2 ? zoom : 1
}

// Pixel width of a YouTube still by its name. Source-site images (og:image) are featured images
// of at least 1200px, so anything that is not a known small YouTube still counts as large.
const SMALL = /\/mq(default|[123])\.jpg(\?|$)/
const WIDTHS: [RegExp, number][] = [
  [/\/maxres(default|[123])\.jpg(\?|$)/, 1280],
  [/\/sd(default|[123])\.jpg(\?|$)/, 640],
  [/\/hq(default|[123])\.jpg(\?|$)/, 480],
]
export const widthOf = (url: string) =>
  SMALL.test(url) ? 320 : (WIDTHS.find(([re]) => re.test(url))?.[1] ?? 1280)

// The 640px "sd" version of a 1280px YouTube still (YouTube serves both sizes whenever the large
// one exists; its 4:3 letterbox bars fall outside a 16:9 slot), for 2x screens and mid-size slots.
const SD = /\/maxres(default|[123])\.jpg(\?|$)/
const sdOf = (url: string) => (SD.test(url) ? url.replace('/maxres', '/sd') : null)

export interface SlotImages {
  small: string
  large: string
  srcSet: string | undefined
  /** Zoom that pushes black bars baked into every one of these images out of the slot (1: none). */
  zoom: number
}

/**
 * Sources for a 16:9 slot showing `large`, whose 320px version is `small`; a srcSet from 640px.
 * Whatever size the browser picks takes the large image's zoom (`zoomOf`, from frame-crops.json),
 * so sizes that need another one stay out: a 4:3 video's 640px stills lack the pillarbox of its
 * 320px ones, and an og:image the bars of YouTube's thumbnail.
 */
export function slotImages(
  small: string,
  large: string,
  zoomOf: (src: string) => number,
): SlotImages {
  const width = widthOf(large)
  const zoom = zoomOf(large)
  const fits = (src: string | null): src is string => !!src && zoomOf(src) === zoom
  const sd = sdOf(large)
  const srcSet =
    width >= 640
      ? [fits(small) && `${small} 320w`, fits(sd) && `${sd} 640w`, `${large} ${width}w`]
          .filter(Boolean)
          .join(', ')
      : undefined
  return { small: fits(small) ? small : large, large, srcSet, zoom }
}

/**
 * `sizes` of the watch stage's player poster (the page's width on phones, two thirds of it beside
 * Up next); the static shells preload the poster with the same sizes, so both pick one file.
 */
export const STAGE_SIZES = '(min-width: 1024px) 66vw, 100vw'

export type VideoImages = Pick<
  Video,
  'thumbnail' | 'thumbnails' | 'backdrop' | 'poster' | 'frames' | 'slides'
>

const at = <T>(list: readonly T[], turn: number) =>
  list[((turn % list.length) + list.length) % list.length]

// A source image WordPress resized below 640px wide ("…-200x143.png"): the site's logo standing in
// for a missing featured image, never the video's picture. It may also have stood in for a missing
// default still, so YouTube's 480px thumbnail (always served) takes its place.
const RESIZED = /-(\d+)x\d+\.\w+$/
const sourceImage = (b: string | undefined) =>
  b && !(Number(RESIZED.exec(b)?.[1]) < 640) ? b : undefined

/**
 * The image fields of a video. Candidates are the YouTube thumbnail and its three stills (small
 * and large share an index). Flagged ones (a face not smiling, eyes closed, a dark or blank still)
 * never rotate in or reach the reel; ranked videos rotate their beautiful candidates (else the best
 * one) and lead with the best; stills that repeat a shot count once. When every candidate is
 * flagged, the least bad one stands in. `turn` picks this page load's member of the rotation.
 */
export function videoImages(
  r: Pick<CatalogRecord, 'y' | 'm' | 's' | 'q' | 'b'>,
  flags: number,
  turn = 0,
): VideoImages {
  const hiRes = r.m !== 0
  const source = sourceImage(r.b)
  // Without 1280px stills, the 640px "sd" ones (4:3 letterboxed; object-fit: cover crops the bars)
  // still beat the 320px thumbnails when enlarged; `s: 0` marks videos that lack those too, and
  // `q: 0` videos without any stills, where only the thumbnail exists.
  const size = hiRes ? 'maxres' : r.s === 0 ? 'mq' : 'sd'
  const frames = r.q === 0 ? [] : [1, 2, 3]
  const small = [image(r.y, 'mqdefault'), ...frames.map((n) => image(r.y, `mq${n}`))]
  const large = [
    source ?? image(r.y, r.b ? 'hqdefault' : `${size}default`),
    ...frames.map((n) => image(r.y, `${size}${n}`)),
  ]
  const mask = maskOf(flags)
  const ranking = rankingOf(flags)
  const pairs = duplicatePairsOf(flags)
  const beautiful = (i: number) => !!(beautyBitsOf(flags) & (1 << i))
  const repeats = (i: number, j: number) =>
    pairs.some(([a, b]) => (a === i && b === j) || (a === j && b === i))
  // Clean candidates best first, each shot once (the better ranked of two near-duplicates stays).
  const clean = (ranking ?? [0, 1, 2, 3])
    .filter((i) => i < small.length && !(mask & (1 << i)))
    .filter((i, k, list) => !list.slice(0, k).some((j) => repeats(i, j)))
  // The canonical image: the best clean candidate, else the least bad one.
  const lead = clean[0] ?? (small.length > 1 ? fallbackOf(flags) : 0)
  const pretty = clean.filter(beautiful)
  // Ranked videos rotate their beautiful candidates (else show the best); unranked ones all clean.
  const pool = ranking ? (pretty.length ? pretty : [lead]) : clean.length ? clean : [lead]
  const pick = at(pool, turn)
  // The reel's three shots: the beautiful clean stills best first (else all clean stills), repeated
  // to three; the canonical image when none is clean (no shots at all without stills).
  const stills = clean.filter((i) => i > 0)
  const best = ranking ? stills.filter(beautiful) : []
  const reel = best.length ? best : stills
  const shots = reel.length
    ? [0, 1, 2].map((k) => reel[k % reel.length])
    : frames.length
      ? [lead, lead, lead]
      : []
  const slides = shots.map((i) => !!(slideBitsOf(flags) & (1 << i)))
  return {
    thumbnail: small[pick],
    // The canonical image first (hero slots and lists use it), then the reel shots, small.
    thumbnails: [small[lead], ...shots.map((i) => small[i])],
    // A source-site image (og:image) beats the 640px stills for big slots when it leads.
    backdrop: !hiRes && source && lead === 0 ? source : large[pick],
    poster: large[lead],
    frames: shots.map((i) => large[i]),
    ...(slides.includes(true) && { slides }),
  }
}
