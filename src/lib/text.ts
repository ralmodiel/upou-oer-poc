// Text pipeline shared by the recommendation engine (browser) and scripts/text/* (Node 24 imports
// this file directly, hence the explicit .ts extension below).
import type { Video } from '../types'
import { isGenericTag } from './tags.ts'

const ENGLISH = `a an the and or but nor of in on at to for from by with about as into through over under
between among within without after before during is are was were be been being am do does did done
have has had having will would shall should can could may might must not no so if then than that this
these those there here it its they them their we our us you your he she his her him i me my who whom
whose which what when where why how all any each every some such only own same too very just also more
most other both few up down out off again further once via vs versus etc per dont cant wont isnt arent
didnt doesnt wasnt im youre thats whats heres theres lets using`

// Function words and particles; content words such as "man" or "may" are kept.
const FILIPINO = `ang ng nang sa mga at ay na ko mo ito iyan iyon yan yun yon para ba kung hindi din rin
yung lang naman po ho kay kina ni si sina ako ikaw ka siya sya kami tayo kayo sila akin iyo kanya amin
atin inyo kanila natin namin ninyo nila niya dito diyan doon rito roon mayroon meron wala oo huwag wag pa
pala daw raw kasi dahil pero ngunit subalit o kaya upang nga muna sana tulad gaya ganito ganyan ganoon
ano sino saan kailan bakit paano ilan alin isang mula hanggang tungkol ukol ayon lahat iba pang mas lalo
eh ah`

// Structure words (episode numbering) and honorifics say nothing about the topic.
const NOISE = `part pt episode ep chapter module lesson week day session series video videos post mr mrs
ms dr prof asst assoc engr atty sir maam hon ph`

export const STOPWORDS: ReadonlySet<string> = new Set(
  `${ENGLISH} ${FILIPINO} ${NOISE}`.split(/\s+/),
)

const NON_ASCII = /[^\x20-\x7e]/

/** Lowercase ASCII-ish text: diacritics and apostrophes removed ("Niña's" → "ninas"). */
export const normalizeText = (s: string): string =>
  (NON_ASCII.test(s) ? s.normalize('NFD').replace(/\p{Diacritic}/gu, '') : s)
    .toLowerCase()
    .replace(/['’‘`´]/g, '')

const undouble = (s: string) => (/([^aeiou lsz])\1$/.test(s) ? s.slice(0, -1) : s)

const isDigit = (code: number) => code >= 48 && code <= 57
const hasDigit = (s: string) => {
  for (let i = 0; i < s.length; i++) if (isDigit(s.charCodeAt(i))) return true
  return false
}
const allDigits = (s: string) => {
  for (let i = 0; i < s.length; i++) if (!isDigit(s.charCodeAt(i))) return false
  return true
}

/** Light English suffix stripping (plurals, -ing, -ed). Filipino affixes are left alone. */
export function stem(token: string): string {
  if (token.length < 4 || hasDigit(token)) return token
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (token.endsWith('sses')) return token.slice(0, -2)
  if (token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) return token
  if (token.endsWith('s')) return token.slice(0, -1)
  if (token.endsWith('ing') && token.length >= 7) return undouble(token.slice(0, -3))
  if (token.endsWith('ed') && token.length >= 6) return undouble(token.slice(0, -2))
  return token
}

const keep = (w: string) => w.length > 1 && !STOPWORDS.has(w) && !allDigits(w)

export interface TokenizeOptions {
  /** Also emit "a b" pairs of adjacent terms (within a phrase); used for titles and queries. */
  bigrams?: boolean
}

// Tags, categories and channels repeat across the catalog; their token lists are shared, read-only.
const memo = new Map<string, readonly string[]>()
const MEMO_MAX_LENGTH = 80
const MEMO_MAX_SIZE = 20_000

/** Stemmed content terms of a text, in order. Do not mutate the result. */
export function tokenize(
  text: string,
  { bigrams = false }: TokenizeOptions = {},
): readonly string[] {
  const key = text.length <= MEMO_MAX_LENGTH ? `${bigrams ? 'b' : 'u'}${text}` : undefined
  const hit = key && memo.get(key)
  if (hit) return hit
  const out: string[] = []
  const clean = normalizeText(text)
  // Unicode classes are needed only for the few non-Latin texts.
  const [phraseSplit, wordSplit] = NON_ASCII.test(clean)
    ? [/[^\p{L}\p{N}\s-]+/u, /[^\p{L}\p{N}]+/u]
    : [/[^a-z0-9\s-]+/, /[^a-z0-9]+/]
  // Punctuation other than hyphens ends a phrase, so bigrams never span "Title: Subtitle | Speaker".
  for (const phrase of clean.split(phraseSplit)) {
    const terms = phrase.split(wordSplit).filter(keep).map(stem)
    out.push(...terms)
    if (bigrams) for (let i = 1; i < terms.length; i++) out.push(`${terms[i - 1]} ${terms[i]}`)
  }
  if (key) {
    if (memo.size >= MEMO_MAX_SIZE) memo.clear()
    memo.set(key, out)
  }
  return out
}

export const FIELD_WEIGHTS = {
  title: 3,
  titleBigram: 1.5,
  tags: 2,
  category: 1.5,
  channel: 0.5,
  description: 1,
  transcript: 1,
} as const

// Same label as GENERAL_CATEGORY in src/data/catalog.ts (not imported: this file must stay
// loadable by Node without the catalog JSON). Membership there is not a topic.
const GENERAL = 'General'
// A term repeated across title and several tags ("FASTLearn", "FASTLearn Series 1", …) is still one topic.
const MAX_TERM_WEIGHT = FIELD_WEIGHTS.title * 1.5
const MAX_TRANSCRIPT_TERMS = 300

/**
 * Weighted bag of terms for one video. Transcript terms (already tokenized) use a sublinear count
 * and are scaled so that, in total, they never outweigh the metadata.
 */
export function termWeightsOf(
  video: Video,
  transcriptTerms?: readonly string[],
): Map<string, number> {
  const weights = new Map<string, number>()
  const add = (term: string, w: number) => weights.set(term, (weights.get(term) ?? 0) + w)
  const addAll = (terms: readonly string[], w: number) => terms.forEach((t) => add(t, w))

  for (const t of tokenize(video.title, { bigrams: true })) {
    add(t, t.includes(' ') ? FIELD_WEIGHTS.titleBigram : FIELD_WEIGHTS.title)
  }
  for (const tag of video.tags) if (!isGenericTag(tag)) addAll(tokenize(tag), FIELD_WEIGHTS.tags)
  if (video.category !== GENERAL) addAll(tokenize(video.category), FIELD_WEIGHTS.category)
  addAll(tokenize(video.channel), FIELD_WEIGHTS.channel)
  if (video.description) addAll(tokenize(video.description), FIELD_WEIGHTS.description)
  for (const [t, w] of weights) if (w > MAX_TERM_WEIGHT) weights.set(t, MAX_TERM_WEIGHT)

  if (transcriptTerms?.length) {
    const counts = new Map<string, number>()
    for (const t of transcriptTerms) counts.set(t, (counts.get(t) ?? 0) + 1)
    const scored = [...counts]
      .map(([t, n]) => [t, 1 + Math.log(n)] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TRANSCRIPT_TERMS)
    let metaMass = 0
    for (const w of weights.values()) metaMass += w
    const mass = scored.reduce((s, [, w]) => s + w, 0)
    const scale = FIELD_WEIGHTS.transcript * Math.min(1, metaMass / mass)
    for (const [t, w] of scored) add(t, w * scale)
  }
  return weights
}
