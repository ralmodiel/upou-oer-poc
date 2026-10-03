import type { CSSProperties } from 'react'
import { yearOf } from '../../lib/format'
import { pick, seededRandom } from '../../lib/seed'
import { isGenericTag, tagKey, tidyTag } from '../../lib/tags'
import type { Video } from '../../types'
import { reelImages, type Still } from './stills'

export type Template = 'cinematic' | 'split' | 'kinetic'
export type Transition = 'fade' | 'slide' | 'zoom' | 'wipe' | 'iris'
export type Accent = 'forest' | 'amber' | 'gold' | 'ink'

// Beat times (ms) inside the 10 s reel.
export const SHOT_AT = [1500, 3500, 5500] as const
export const END_AT = 7500
export const TICK_AT = [8050, 8600, 9150] as const
// The end card's art grows into the player's frame from here to the end.
export const OUT_AT = 9500

const TEMPLATES: readonly Template[] = ['cinematic', 'split', 'kinetic']
const TRANSITIONS: readonly Transition[] = ['fade', 'slide', 'zoom', 'wipe', 'iris']
const ENDINGS = ['iris', 'fade', 'rise'] as const
// Accent colours from the UPOU logos (maroon stays reserved for the wordmark, progress and Skip).
const ACCENTS: readonly Accent[] = ['forest', 'amber', 'gold', 'ink']
/** Longest title the reel sets in type; longer ones are cut at a word boundary with an ellipsis. */
export const REEL_TITLE_MAX = 140
// Kinetic titles longer than this enter a line at a time instead of word by word.
const KINETIC_WORDS = 6
// Root notes (A1–C2) for the audio sting.
const NOTES = [55, 58.27, 61.74, 65.41]

type Vars = Record<`--${string}`, string | number>

export interface Word {
  text: string
  hot: boolean
  style: CSSProperties
}

export interface Line {
  words: Word[]
  outline: boolean
  style: CSSProperties
}

export interface Shot {
  src: string
  /** 320px version of the same still, for preview stages. */
  small: string
  /** A slide or title card: shown whole, without a zoom, over a blurred copy of itself. */
  slide: boolean
  tx: Transition
  style: CSSProperties
}

export interface ReelPlan {
  template: Template
  accent: Accent
  side: 'left' | 'right'
  motion: 'slam' | 'slide'
  ending: (typeof ENDINGS)[number]
  /** No 1280px stills (640px or 320px ones): the reel frames them instead of blowing them up. */
  lowRes: boolean
  /** Every shot is the same still: one long move replaces the three cuts. */
  single: boolean
  /** Some shot is a slide or title card (shown whole; no template sets type on a picture). */
  slides: boolean
  /** Kinetic long titles enter a line at a time (`line`), everything else word by word. */
  unit: 'word' | 'line'
  style: CSSProperties
  /** Title as shown in the reel (clamped to REEL_TITLE_MAX). */
  title: string
  kicker: string
  kickerStyle: CSSProperties
  titleStyle: CSSProperties
  lines: Line[]
  hook: string
  hookStyle: CSSProperties
  tags: { text: string; style: CSSProperties }[]
  storyStyle: CSSProperties
  /** End-card byline: channel, then "category · year" (phones show only the latter). */
  meta: string[]
  shots: Shot[]
  rootHz: number
}

const css = (vars: Vars) => vars as CSSProperties
const ms = (n: number) => `${Math.round(n)}ms`
const pct = (n: number) => `${n.toFixed(2)}%`

export const TICK_STYLES = TICK_AT.map((t) => css({ '--d': ms(t) }))
export const INDEX_STYLES = SHOT_AT.map((t) => css({ '--d': ms(t) }))

/** Cuts a long title at a word boundary near `max` chars and adds an ellipsis. */
export function clampTitle(title: string, max = REEL_TITLE_MAX): string {
  const clean = title.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?–—-]+$/, '')}…`
}

/** Short teaser from free text: first sentence(s), ellipsized near `max` chars. */
export function hookFrom(text: string, max = 110): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^in this (video|episode|lecture|session|talk),\s*/i, '')
  if (!clean) return ''
  const sentences = clean.split(/(?<=[.!?])\s+(?=["'“(\p{Lu}\d])/u)
  // Join fragments so abbreviations like "Dr." never end the hook early.
  let hook = sentences[0]
  for (let i = 1; i < sentences.length && hook.length < 60; i++) hook += ` ${sentences[i]}`
  hook = hook.charAt(0).toUpperCase() + hook.slice(1)
  if (hook.length <= max) return hook
  const cut = hook.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.!?–—-]+$/, '')}…`
}

/** Distinct, readable topic tags, shortest first. */
export function topicsOf(video: Video, max = 6): string[] {
  const taken = [tagKey(video.category)].filter(Boolean)
  const topics: string[] = []
  const candidates = video.tags
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => t.length > 1 && t.length <= 26 && !isGenericTag(t))
    .sort((a, b) => a.length - b.length)
  for (const tag of candidates) {
    const key = tagKey(tag)
    // Skip series variants such as "TechTips Series 1" once "TechTips" is in.
    if (!key || taken.some((k) => key.startsWith(k) || k.startsWith(key))) continue
    taken.push(key)
    topics.push(tidyTag(tag))
    if (topics.length === max) break
  }
  return topics
}

/** Splits words into up to `maxLines` lines of similar length. */
export function toLines(words: string[], maxLines = 4): string[][] {
  const total = words.join(' ').length
  const count = Math.max(1, Math.min(maxLines, words.length, Math.round(total / 12)))
  const target = total / count
  const lines: string[][] = []
  let line: string[] = []
  let len = 0
  for (const word of words) {
    const next = len ? len + 1 + word.length : word.length
    if (len && lines.length < count - 1 && next - target > target - len) {
      lines.push(line)
      line = [word]
      len = word.length
    } else {
      line.push(word)
      len = next
    }
  }
  lines.push(line)
  return lines
}

// A Ken Burns move: scale s0 → s1 about a crop origin (fractions of the frame), panning along `angle`.
interface Move {
  s0: number
  s1: number
  ox: number
  oy: number
  angle: number
}

function kenBurns(rand: () => number, frameRand: () => number): Move {
  const lo = 1.06 + rand() * 0.03
  const hi = 1.17 + rand() * 0.07
  const [s0, s1] = rand() < 0.5 ? [lo, hi] : [hi, lo]
  const angle = rand() * Math.PI * 2
  // Off-centre to one side, and a little high so heads stay in frame.
  const ox = 0.5 + (frameRand() < 0.5 ? -1 : 1) * (0.18 + frameRand() * 0.17)
  const oy = 0.36 + frameRand() * 0.16
  return { s0, s1, ox, oy, angle }
}

// A repeated still comes back reframed: the mirrored crop (never the mirrored image, which would
// flip any text in it), zooming and panning the other way, and a little tighter.
const reframe = (m: Move, tighter: number): Move => ({
  s0: m.s1 + tighter,
  s1: m.s0 + tighter,
  ox: 1 - m.ox,
  oy: m.oy,
  angle: m.angle + Math.PI,
})

// Slides and title cards stay whole. 640px stills are 4:3 with the 16:9 picture letterboxed, so
// they keep a sliver of zoom that hides the bars' soft edges.
const still = (src: string) => (/\/sd[1-3]\.jpg$/.test(src) ? 1.02 : 1)

const holdVars = (src: string): Vars => ({
  '--ko': '50% 50%',
  '--ks0': still(src),
  '--ks1': still(src),
  '--kx0': '0%',
  '--ky0': '0%',
  '--kx1': '0%',
  '--ky1': '0%',
})

/**
 * One still under the whole montage: a slow push-in about a point in the upper middle (where
 * faces usually are) that drifts to one side as it settles. It opens on the full frame, so the
 * card image or loading cover it follows hands over without a jump. Zoom and drift ease
 * differently (reel.css) and the drift always trails the zoom, so the path curves and the edges
 * stay covered.
 */
function longMoveVars(rand: () => number, src: string): Vars {
  const s0 = still(src)
  const s1 = s0 + 0.1 + rand() * 0.1
  const ox = 0.32 + rand() * 0.36
  const oy = 0.28 + rand() * 0.18
  // Room to shift at the final scale (fractions of the frame): right is ox·(s−1), left (1−ox)·(s−1).
  const right = rand() < 0.5
  const kx = (0.35 + rand() * 0.5) * (right ? ox : -(1 - ox)) * (s1 - 1)
  // Mostly downward (the top of the frame, where heads are, comes in), sometimes a little up.
  const ky = (rand() * 0.6 - 0.15) * (rand() < 0.5 ? oy : 1 - oy) * (s1 - 1)
  return {
    '--ko': `${pct(ox * 100)} ${pct(oy * 100)}`,
    '--ks0': s0,
    '--ks1': s1.toFixed(3),
    '--kx0': '0%',
    '--ky0': '0%',
    '--kx1': pct(kx * 100),
    '--ky1': pct(ky * 100),
  }
}

function moveVars({ s0, s1, ox, oy, angle }: Move): Vars {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle) * 0.7
  // How far (% of the frame) the still can shift one way at scale s and keep the edges covered.
  const room = (s: number, origin: number, way: number) =>
    (way > 0 ? origin : 1 - origin) * (s - 1) * 85
  return {
    '--ko': `${pct(ox * 100)} ${pct(oy * 100)}`,
    '--ks0': s0.toFixed(3),
    '--ks1': s1.toFixed(3),
    '--kx0': pct(-dx * room(s0, ox, -dx)),
    '--ky0': pct(-dy * room(s0, oy, -dy)),
    '--kx1': pct(dx * room(s1, ox, dx)),
    '--ky1': pct(dy * room(s1, oy, dy)),
  }
}

function transitionVars(tx: Transition, rand: () => number): Vars {
  const dir = Math.floor(rand() * 4)
  const at = `${pct(25 + rand() * 50)} ${pct(30 + rand() * 40)}`
  switch (tx) {
    case 'slide': {
      const [x, y] = [
        ['-100%', '0%'],
        ['100%', '0%'],
        ['0%', '-100%'],
        ['0%', '100%'],
      ][dir]
      return { '--tx-x': x, '--tx-y': y }
    }
    case 'wipe':
      return {
        '--wipe-from': [
          'inset(0 100% 0 0)',
          'inset(0 0 0 100%)',
          'inset(0 0 100% 0)',
          'inset(100% 0 0 0)',
        ][dir],
        '--wipe-to': 'inset(0 0 0 0)',
      }
    case 'iris':
      return { '--wipe-from': `circle(0% at ${at})`, '--wipe-to': `circle(150% at ${at})` }
    case 'zoom':
      return { '--tx-origin': at }
    default:
      return {}
  }
}

/** Everything the reel shows, derived deterministically from the video's data. */
export function buildReelPlan(video: Video): ReelPlan {
  const seed = video.youtubeId || video.id
  const rand = seededRandom(seed)
  // Framing has its own sequence, so the rest of the plan stays as it was.
  const frameRand = seededRandom(`${seed}:framing`)
  // Face-safe stills only, best first (none: no shots, and callers skip the reel).
  const stills: Still[] = reelImages(video).stills
  const sources = stills.length ? SHOT_AT.map((_, i) => stills[i % stills.length]) : []
  const frames = sources.map((s) => s.src)
  // One still three times would stutter: it gets a single slow move under the whole montage.
  const single = new Set(frames).size === 1
  // The original thumbnail standing in for all three stills is often a title card with its own
  // type: like a slide it shows whole. No template sets type on the picture, so slides take the
  // seeded template like everything else.
  const card = single && !/\/(maxres|sd|mq)[1-3]\.jpg$/.test(frames[0])
  const slides = card || sources.some((s) => s.slide)
  const template = pick(rand, TEMPLATES)
  const accent = pick(rand, ACCENTS)
  const side = rand() < 0.5 ? 'left' : 'right'
  const motion = rand() < 0.5 ? 'slam' : 'slide'
  const ending = pick(rand, ENDINGS)
  const rootHz = pick(rand, NOTES)
  const category = video.category.trim()

  const lowRes = !frames.some((src) => /maxres/.test(src))
  // Repeats crop tighter; the split panel is half the stage, so it can go deeper.
  const tighter = lowRes ? 0.05 : template === 'split' ? 0.24 : 0.16
  const moves: Move[] = []
  let prev: Transition | undefined
  let drift = 1
  const shots = sources
    .map((source, i): Shot => {
      const at = SHOT_AT[i]
      const tx = pick(
        rand,
        TRANSITIONS.filter((t) => t !== prev),
      )
      prev = tx
      const fresh = kenBurns(rand, frameRand)
      const first = frames.indexOf(source.src)
      const move = first < i ? reframe(moves[first], tighter) : fresh
      moves.push(move)
      const slide = slides && (card || !!source.slide)
      const kb = slide
        ? holdVars(source.src)
        : single
          ? longMoveVars(frameRand, source.src)
          : moveVars(move)
      // Text drifts against the first pan for a touch of parallax.
      if (i === 0)
        drift = parseFloat(String(kb['--kx1'])) > parseFloat(String(kb['--kx0'])) ? -1 : 1
      // Hide once fully covered (longest cover transition is the 1.1 s end-card iris).
      const hideAt = (single ? END_AT : (SHOT_AT[i + 1] ?? END_AT)) + 1200
      return {
        src: source.src,
        small: source.small,
        slide,
        tx,
        style: css({
          '--s': ms(at),
          '--o': ms(hideAt),
          ...(single && { '--kb-ms': ms(hideAt - at) }),
          ...kb,
          ...transitionVars(tx, rand),
        }),
      }
    })
    .slice(0, single ? 1 : undefined)

  // Hook: description first; otherwise the topics themselves (facts, no boilerplate), and the
  // chips take the rest. A video with neither shows its title and kicker alone.
  const topics = topicsOf(video)
  let hook = hookFrom(video.description)
  let chips = topics.slice(0, 3)
  if (!hook && topics.length) {
    hook = topics.slice(0, 3).join(' · ')
    chips = topics.slice(3, 6)
  }

  const title = clampTitle(video.title)
  const words = title.split(/\s+/).filter(Boolean)
  const chars = title.length
  const long = words.length > 7 || chars > 48
  const kinetic = template === 'kinetic'
  const byLine = kinetic && words.length > KINETIC_WORDS
  const firstWord = SHOT_AT[0] + 250
  // Kinetic words land one clear of the next: a slam settles before the next word grows over its
  // place. Other templates fit the whole title into 0.9 s.
  const step = kinetic
    ? motion === 'slam'
      ? 240
      : 190
    : Math.min(120, 900 / Math.max(1, words.length - 1))
  const hookIn = long ? 4600 : 4100
  const chipsIn = hookIn + 1000
  const exitAt = END_AT - 350
  // The band holds one thing at a time: the hook takes the title's place; with none the title stays.
  const titleOut = hook ? hookIn - 450 : exitAt

  const longest = Math.max(...words.map((w) => w.length))
  const hotCandidates = words.flatMap((w, i) => (w.length === longest ? [i] : []))
  const hot = longest >= 4 ? pick(rand, hotCandidates) : -1
  // Kinetic sets each line on its own, at most three in the band.
  const wordLines = toLines(words, kinetic ? 3 : 4)
  const outline = wordLines.length > 1 && rand() < 0.6 ? Math.floor(rand() * wordLines.length) : -1
  const from = rand() < 0.5 ? 1 : -1
  const lineStep = Math.min(300, 1400 / Math.max(1, wordLines.length - 1))

  let index = 0
  const lines = wordLines.map((line, li): Line => {
    const dir = li % 2 ? -from : from
    const start = byLine ? firstWord + li * lineStep : firstWord + index * step
    // Lines sliding in from the left lead with their last word, so no word passes another.
    const reverse = kinetic && motion === 'slide' && dir < 0
    const built = line.map((text, k): Word => {
      const i = index++
      const at = byLine ? start : start + (reverse ? line.length - 1 - k : k) * step
      return { text, hot: i === hot, style: css({ '--w': ms(at) }) }
    })
    return {
      words: built,
      outline: li === outline && !built.some((w) => w.hot),
      style: css({ '--from': dir, '--lw': ms(start) }),
    }
  })

  const titleScale =
    chars <= 24 ? 1 : chars <= 44 ? 0.82 : chars <= 70 ? 0.66 : chars <= 100 ? 0.56 : 0.5
  const maxLine = Math.max(4, ...wordLines.map((l) => l.join(' ').length))
  const year = yearOf(video.publishedAt)
  const yearText = Number.isFinite(year) ? String(year) : ''

  return {
    template,
    accent,
    side,
    motion,
    ending,
    lowRes,
    single,
    slides,
    unit: byLine ? 'line' : 'word',
    style: css({
      '--t1': ms(SHOT_AT[0]),
      '--t2': ms(SHOT_AT[1]),
      '--t3': ms(SHOT_AT[2]),
      '--tend': ms(END_AT),
      '--tout': ms(OUT_AT),
      '--drift': drift,
      '--title-scale': titleScale,
      // Kinetic lines fill the band's width (serif glyphs ≈ 0.5em) within its height (reel.css).
      '--chars': (maxLine * 0.5).toFixed(2),
      '--klines': (wordLines.length * 0.98).toFixed(2),
    }),
    title,
    // Non-breaking around the dot so the year never wraps onto a line of its own.
    kicker: [category, yearText].filter(Boolean).join('\u00a0·\u00a0'),
    kickerStyle: css({ '--d': ms(SHOT_AT[0] + 100) }),
    titleStyle: css({ '--o': ms(titleOut) }),
    lines,
    hook,
    hookStyle: css({ '--d': ms(hookIn) }),
    tags: chips.map((text, i) => ({ text, style: css({ '--g': ms(chipsIn + i * 120) }) })),
    storyStyle: css({ '--o': ms(exitAt) }),
    meta: [video.channel, [category, yearText].filter(Boolean).join(' · ')].filter(Boolean),
    shots,
    rootHz,
  }
}
