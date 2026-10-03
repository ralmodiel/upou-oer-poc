import type { CSSProperties } from 'react'
import { yearOf } from '../../lib/format'
import { pick, seededRandom } from '../../lib/seed'
import { isGenericTag, tagKey, tidyTag } from '../../lib/tags'
import type { Video } from '../../types'

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

function kenBurns(rand: () => number) {
  const lo = 1.06 + rand() * 0.03
  const hi = 1.17 + rand() * 0.07
  const [s0, s1] = rand() < 0.5 ? [lo, hi] : [hi, lo]
  // Max pan (% of the frame) that keeps the edges covered at scale s.
  const room = (s: number) => (s - 1) * 50 * 0.85
  const angle = rand() * Math.PI * 2
  const dx = Math.cos(angle)
  const dy = Math.sin(angle) * 0.7
  return {
    dx,
    vars: {
      '--ks0': s0.toFixed(3),
      '--ks1': s1.toFixed(3),
      '--kx0': pct(-dx * room(s0)),
      '--ky0': pct(-dy * room(s0)),
      '--kx1': pct(dx * room(s1)),
      '--ky1': pct(dy * room(s1)),
    } satisfies Vars,
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
  const rand = seededRandom(video.youtubeId || video.id)
  const template = pick(rand, TEMPLATES)
  const accent = pick(rand, ACCENTS)
  const side = rand() < 0.5 ? 'left' : 'right'
  const motion = rand() < 0.5 ? 'slam' : 'slide'
  const ending = pick(rand, ENDINGS)
  const rootHz = pick(rand, NOTES)
  const category = video.category.trim()

  const frames = video.frames.length ? video.frames : [video.backdrop]
  // The thumbnail set is the original plus the three stills at 320px.
  const smallFrames = video.thumbnails?.slice(1) ?? []
  const lowRes = !frames.some((src) => /maxres/.test(src))
  let prev: Transition | undefined
  let drift = 1
  const shots = SHOT_AT.map((at, i): Shot => {
    const tx = pick(
      rand,
      TRANSITIONS.filter((t) => t !== prev),
    )
    prev = tx
    const kb = kenBurns(rand)
    // Text drifts against the first pan for a touch of parallax.
    if (i === 0) drift = kb.dx >= 0 ? -1 : 1
    // Hide once fully covered (longest cover transition is the 1.1 s end-card iris).
    const hideAt = (SHOT_AT[i + 1] ?? END_AT) + 1200
    return {
      src: frames[i % frames.length],
      small: smallFrames[i % smallFrames.length] ?? frames[i % frames.length],
      tx,
      style: css({ '--s': ms(at), '--o': ms(hideAt), ...kb.vars, ...transitionVars(tx, rand) }),
    }
  })

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
  const firstWord = SHOT_AT[0] + 250
  const span = Math.min(kinetic ? 1300 : 900, (words.length - 1) * (kinetic ? 190 : 120))
  const step = words.length > 1 ? span / (words.length - 1) : 0
  const hookIn = long ? 4600 : 4100
  const chipsIn = hookIn + 1000
  const exitAt = END_AT - 350
  // Cinematic swaps the title for the hook in the centre; with no hook the title stays.
  const titleOut = template === 'cinematic' && hook ? hookIn - 450 : exitAt

  const longest = Math.max(...words.map((w) => w.length))
  const hotCandidates = words.flatMap((w, i) => (w.length === longest ? [i] : []))
  const hot = longest >= 4 ? pick(rand, hotCandidates) : -1
  // Kinetic sets each line on its own; more, shorter lines keep long titles large on phones.
  const wordLines = toLines(words, kinetic ? 7 : 4)
  const outline = wordLines.length > 1 && rand() < 0.6 ? Math.floor(rand() * wordLines.length) : -1
  const from = rand() < 0.5 ? 1 : -1

  let index = 0
  const lines = wordLines.map((line, li): Line => {
    const built = line.map((text): Word => {
      const i = index++
      return { text, hot: i === hot, style: css({ '--w': ms(firstWord + i * step) }) }
    })
    return {
      words: built,
      outline: li === outline && !built.some((w) => w.hot),
      style: css({ '--from': li % 2 ? -from : from }),
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
    style: css({
      '--t1': ms(SHOT_AT[0]),
      '--t2': ms(SHOT_AT[1]),
      '--t3': ms(SHOT_AT[2]),
      '--tend': ms(END_AT),
      '--tout': ms(OUT_AT),
      '--dim': ms(hookIn - 150),
      '--drift': drift,
      '--title-scale': titleScale,
      // Kinetic type fills the width (serif glyphs ≈ 0.52em) within ~50% of the height;
      // phone stages show at most four lines (reel.css hides the rest).
      '--kw': (88 / (maxLine * 0.52)).toFixed(2),
      '--kh': (50 / (wordLines.length * 0.95)).toFixed(2),
      '--kh-s': (46 / (Math.min(wordLines.length, 4) * 0.95)).toFixed(2),
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
