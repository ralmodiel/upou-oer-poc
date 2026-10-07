// Spelling-tolerant matching for search: a query word found in few videos also matches catalog
// words a typo or two away ("nutritoin" → "nutrition", "gendr" → "gender"). Text is compared as
// runs of words (see wordsOf), so whole words, word starts and parts of words rank apart.

/** A query word and the catalog words it may be a misspelling of. */
export interface Term {
  /** As typed: lowercase, no accents. */
  word: string
  /** Near spellings it also matches, likeliest first (only for words rare as typed). */
  near: readonly string[]
  /** The singular or root ("students" → "student"), matched as a word start; when it differs. */
  stem?: string
  /** A function word ("to", "of", "ang"): it adds to the score but a video may lack it. */
  optional?: boolean
}

/** Catalog words by length, with the number of videos that use each. */
export interface Vocabulary {
  byLength: Bucket[]
}

interface Bucket {
  words: string[]
  counts: number[]
  // Letters present (one bit each), a cheap test before the edit distance.
  letters: number[]
}

// Match strengths, best first: the whole word, the start of a word, inside a word, a near spelling.
export const EXACT = 5
export const PREFIX = 4
export const PART = 3
export const NEAR = 2

const NEAR_LIMIT = 6
// Shorter words are left out of the vocabulary: no 4-letter word is one edit from them.
const MIN_WORD = 3
const LETTERS_ONLY = /^\p{L}+$/u
const ASCII = /^\p{ASCII}*$/u

/** Lowercase without accents ("Économie" → "economie"). */
export const normalize = (s: string) =>
  // Most text is ASCII, so the Unicode work is skipped for it.
  (ASCII.test(s) ? s : s.normalize('NFD').replace(/\p{Diacritic}/gu, '')).toLowerCase()

/** A number written onto the word before it starts a word of its own ("covid19" → "covid 19"). */
export const splitNumbers = (s: string) => s.replace(/(\p{L})(?=\p{N})/gu, '$1 ')

/** Text as words with a space at each end (" climate change basics "), for word tests. */
// Apostrophes join ("Teacher’s" → "teachers"), as in text.ts's normalizeText; "COVID19" reads as
// "COVID-19" does ("covid 19"), as tags.ts's tagKey has them the same.
export const wordsOf = (text: string) =>
  ` ${splitNumbers(
    normalize(text)
      .replace(/['’‘`´]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' '),
  ).trim()} `

/** Edits allowed for a word: none up to 3 letters, one up to 7, two from 8. */
export const maxEdits = (word: string) => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0)

/**
 * The fewest edits (insert, delete or replace a letter, or swap two neighbours) that turn `a`
 * into `b`: Damerau-Levenshtein, optimal string alignment. Past `max` it stops and returns max + 1.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  const n = a.length
  const m = b.length
  if (Math.abs(n - m) > max) return max + 1
  // Three rows of the table: two back (for swaps), the previous one and the current one.
  let back: number[] = new Array(m + 1).fill(0)
  let prev = Array.from({ length: m + 1 }, (_, j) => j)
  let row: number[] = new Array(m + 1).fill(0)
  for (let i = 1; i <= n; i++) {
    row[0] = i
    let least = i
    for (let j = 1; j <= m; j++) {
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d = Math.min(d, back[j - 2] + 1)
      }
      row[j] = d
      if (d < least) least = d
    }
    // No later row can come back under the bound.
    if (least > max) return max + 1
    ;[back, prev, row] = [prev, row, back]
  }
  return Math.min(prev[m], max + 1)
}

const letterBits = (word: string) => {
  let bits = 0
  for (let i = 0; i < word.length; i++) {
    const c = word.charCodeAt(i) - 97
    bits |= 1 << (c >= 0 && c < 26 ? c : 26 + (c & 3))
  }
  return bits
}

const countBits = (n: number) => {
  let count = 0
  for (let v = n >>> 0; v; v &= v - 1) count++
  return count
}

/** Adds the words of `doc` (a word run from wordsOf, one per video) to `counts`, once each. */
export function countWords(counts: Map<string, number>, doc: string): void {
  const seen = new Set<string>()
  for (const word of doc.split(' ')) {
    if (word.length >= MIN_WORD && !seen.has(word) && LETTERS_ONLY.test(word)) seen.add(word)
  }
  for (const word of seen) counts.set(word, (counts.get(word) ?? 0) + 1)
}

/** The counted words (see countWords) as a vocabulary, leaving out those matching `skip`. */
export function vocabularyOf(
  counts: ReadonlyMap<string, number>,
  skip: (word: string) => boolean = () => false,
): Vocabulary {
  const byLength: Bucket[] = []
  for (const [word, count] of counts) {
    if (skip(word)) continue
    const bucket = (byLength[word.length] ??= { words: [], counts: [], letters: [] })
    bucket.words.push(word)
    bucket.counts.push(count)
    bucket.letters.push(letterBits(word))
  }
  return { byLength }
}

/**
 * Collects the words of `docs` (word runs from wordsOf, one string per video) with the number of
 * videos using each; words with digits, shorter than 3 letters or matching `skip` are left out.
 */
export function buildVocabulary(
  docs: Iterable<string>,
  skip?: (word: string) => boolean,
): Vocabulary {
  const counts = new Map<string, number>()
  for (const doc of docs) countWords(counts, doc)
  return vocabularyOf(counts, skip)
}

/** Catalog words within the allowed edits of `word` (see maxEdits): fewest edits, then most used. */
export function nearWords(vocabulary: Vocabulary, word: string, limit = NEAR_LIMIT) {
  const max = maxEdits(word)
  if (!max || !LETTERS_ONLY.test(word)) return []
  const bits = letterBits(word)
  const found: { word: string; edits: number; count: number }[] = []
  for (let length = word.length - max; length <= word.length + max; length++) {
    const bucket = vocabulary.byLength[length]
    if (!bucket) continue
    for (let i = 0; i < bucket.words.length; i++) {
      // Each edit adds or drops at most one letter of each word's set.
      if (countBits(bucket.letters[i] ^ bits) > 2 * max) continue
      const candidate = bucket.words[i]
      if (candidate === word) continue
      const edits = editDistance(word, candidate, max)
      if (edits <= max) found.push({ word: candidate, edits, count: bucket.counts[i] })
    }
  }
  return found.sort((a, b) => a.edits - b.edits || b.count - a.count).slice(0, limit)
}

/** How well a word run (see wordsOf) matches a term: EXACT, PREFIX, PART, NEAR or 0. */
export function matchTier(field: string, term: Term): number {
  if (field.includes(term.word)) {
    if (field.includes(` ${term.word} `)) return EXACT
    return field.includes(` ${term.word}`) ? PREFIX : PART
  }
  // The root as a word or its plain plural ("students" finds "Student Orientation"; "hearing" never
  // finds "heart"), ranked with a part.
  const s = term.stem
  if (s && (field.includes(` ${s} `) || field.includes(` ${s}s `) || field.includes(` ${s}es `)))
    return PART
  // A near spelling counts only as a whole word.
  for (const near of term.near) if (field.includes(` ${near} `)) return NEAR
  return 0
}

/** The query with each misspelt word replaced by its likeliest near spelling ("mental health"). */
export const correctionOf = (terms: readonly Term[]) =>
  terms.some((t) => t.near.length) ? terms.map((t) => t.near[0] ?? t.word).join(' ') : undefined
