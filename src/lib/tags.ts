// Tag clean-up shared by the reel's topic chips, the quick look, the watch page and the search
// page's popular topics.
import { PEOPLE } from './people.ts'

// Full names that mean the same as a short tag: one chip, one topic.
const ALIASES: ReadonlyMap<string, string> = new Map([
  ['facultyofmanagementanddevelopmentstudies', 'fmds'],
  ['facultyofinformationandcommunicationstudies', 'fics'],
  ['facultyofeducation', 'fed'],
  ['continuingeducationprogram', 'cep'],
  ['commissiononhighereducation', 'ched'],
  ['departmentofeducation', 'deped'],
  ['associationofsoutheastasiannations', 'asean'],
  ['openanddistanceelearning', 'odel'],
  ['openanddistanceelearningodel', 'odel'],
  ['massiveopenonlinecourse', 'mooc'],
  ['massiveopenonlinecourses', 'moocs'],
])

/** Ignores case, spaces and punctuation ("Tech Tips" = "TechTips", "COVID19" = "Covid-19"). */
export const tagKey = (tag: string) => {
  const key = tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  return ALIASES.get(key) ?? key
}

// WordPress housekeeping, brand and catalogue tags that say nothing about the topic.
const GENERIC = new Set([
  'video',
  'videos',
  'videopost',
  'pastpost',
  'post',
  'lecture',
  'lectures',
  'videolecture',
  'educational',
  'elearning',
  'upopenuniversity',
  'upou',
  'upounetworks',
  'upoer',
  'tvup',
  'oer',
  'open',
  'university',
  'material',
  'materials',
  'compilation',
  'livestream',
  'livestreaming',
  'tvupupopenuniversity',
  'universityofthephilippinesupopenuniversity',
  'instructionalresources',
  'informative',
  'ltio',
  'proceedings',
  'eproceedings',
  'conferenceeproceedings',
  'videoeproceedings',
  'concept',
  'concepts',
  'experience',
  'interview',
  'interviews',
])

// People are tagged with a title ("Dr. Myra Oruga", "aProf. Benjamin Gonzales", "Mayor Noel Rosal").
// Abbreviations that are also words ("Gen", "Rep", "Sec") count only with their dot.
const HONORIFIC =
  /^((dr|a?prof(essor)?|(asst|assist|assistant|assisstant|assoc|associate)\.? ?prof(essor)?|kat\.? ?prop|mr|ms|mrs|atty|engr|arch|ar|sir|ma'am|hon|dean|fr|sr|br|rev|pres|president|dir|director|chancellor|vice chancellor|ambassador|mayor|governor|senator|sen|secretary|usec|commissioner|judge|congressman|congresswoman|chairperson)\.?|(amb|rep|gov|sec|gen|col|capt|lt|maj)\.)\s+\S/i
// "MS Excel" or "AR apps": an acronym, not a title.
const ACRONYM = /^\p{Lu}{2,4}\s/u
const isTitled = (tag: string) => HONORIFIC.test(tag) && !ACRONYM.test(tag)
const NAME_SUFFIX = /\s(jr|sr|ii|iii|iv)\.?$/i
// An initial ("T", "T.", "t."), or "Ma." (María) before a first name.
const INITIAL = /^(?:[A-Z]\.?|[a-z]\.|Ma\.?)$/
const PARTICLE = /^(de|dela|del|de la|la|los|las|van|von|da|di|du|san|santa|sta|sto)$/i
const WORD = /^\p{Lu}[\p{L}'’-]+$/u
const LETTERS_ONLY = /^[\p{L}'’-]+$/u
// Capitalised but not shouting: "Agnes", not "FAITH".
const PROPER = /^\p{Lu}\p{Ll}[\p{L}'’-]*$/u
// "Elvira N. Baura"; a bare "A", "I" or "O" is a word ("Landing A Job").
const MIDDLE_INITIAL =
  /^\p{Lu}\p{Ll}[\p{L}'’-]*(\s\p{Lu}\p{Ll}[\p{L}'’-]*)?\s(\p{Lu}\.|[B-HJ-NP-Z])\s\p{Lu}\p{Ll}[\p{L}'’-]*$/u

// Cheap pre-check for MIDDLE_INITIAL.
const HAS_INITIAL = /\s[A-Z]\.?\s/

const nameParts = (tag: string) =>
  tag
    .replace(NAME_SUFFIX, '')
    .split(/\s+/)
    .filter((w) => w && !INITIAL.test(w) && !PARTICLE.test(w))

// A titled tag that reads like an office ("Director … and Information Service") teaches no names.
const NOT_A_NAME = /\s(and|of|for|the|in|on|at|to)\s|&/i
const MAX_NAME_PARTS = 5
const MEMO_MAX = 20_000

// A speaker credit in a title ("… | Dr. Agnes Rola"). The hint is a cheap pre-check (most titles
// have none); a credit that is a whole segment teaches the full name.
const CREDIT_HINT =
  /(?:^|\s)(?:Dr|Prof|Professor|Mr|Ms|Mrs|Atty|Engr|Dean|Chancellor|Sir|Ma'am)\.?\s/
const CREDIT =
  /(?:^|\s)(?:Dr|Prof|Professor|Mr|Ms|Mrs|Atty|Engr|Dean|Chancellor|Sir|Ma'am)\.?\s+(?:Ma\.\s+)?(\p{Lu}\p{Ll}[\p{L}'’-]*)\s+\p{Lu}/gu
const CREDIT_SEGMENT =
  /(?:[|–—:]\s*|\s(?:with|by|ni|kasama|featuring)\s+)(?:Dr|Prof|Professor|Mr|Ms|Mrs|Atty|Engr|Dean|Chancellor|Sir|Ma'am)\.?\s+([^|,–—()]+?)\s*(?=$|[|,–—(])/gu

/** Video tags and title; a plain list of tags works too. */
export interface NameSource {
  tags: readonly string[]
  title?: string
}
type Names = Iterable<string> | (() => Iterable<NameSource>)

// Names learned from the catalog: full names from titled tags and speaker credits, so "Myra Oruga"
// is a person too; first names, so "Agnes Rola" is. Learned on first use (most pages never ask);
// answers are remembered until the catalog changes.
let nameSource: Names | undefined
const firstNames = new Set<string>()
const nameTokens = new Set<string>()
// One-word tags that are a surname their own video credits ("claudio" beside "Dr Sylvia
// Estrada-Claudio").
const surnameTags = new Set<string>()
const personMemo = new Map<string, boolean>()
const genericMemo = new Map<string, boolean>()

/** Sets the catalog (or a function returning its videos) that names are learned from. */
export function registerNameTokens(source: Names) {
  nameSource = source
  personMemo.clear()
  genericMemo.clear()
}

const letters = (word: string) => word.toLowerCase().replace(/[^\p{L}'’-]/gu, '')

// A surname and, when it is compound ("Estrada-Claudio"), each of its halves.
const surnameForms = (surname: string) => {
  const word = letters(surname)
  return [word, ...word.split('-').filter((half) => half.length > 2 && half !== word)]
}

/** Learns a name's words; returns its surname forms (none for a lone word). */
const learnParts = (parts: readonly string[]): string[] => {
  const words = parts.map(letters).filter(Boolean)
  if (words.length < 1 || words.length > MAX_NAME_PARTS) return []
  if (words.length > 1) firstNames.add(words[0])
  for (const w of words) nameTokens.add(w)
  if (words.length < 2) return []
  const forms = surnameForms(words[words.length - 1])
  for (const form of forms) nameTokens.add(form)
  return forms
}

/** Learns the name a tag carries; returns its surname forms. */
function learnTag(t: string): string[] {
  if (isTitled(t)) {
    const name = t.replace(HONORIFIC, (m) => m.slice(-1))
    return NOT_A_NAME.test(` ${name} `) ? [] : learnParts(nameParts(name))
  }
  // Untitled but unmistakable: "Elvira N. Baura", "Jose Butch Dalisay Jr."
  const suffixed = NAME_SUFFIX.test(t)
  if (!suffixed && !(HAS_INITIAL.test(t) && MIDDLE_INITIAL.test(t))) return []
  const parts = nameParts(t)
  if (parts.length < 2 || parts.length > 4 || !parts.every((w) => LETTERS_ONLY.test(w))) return []
  return !suffixed || parts.every((w) => PROPER.test(w)) ? learnParts(parts) : []
}

/** Learns the names a title credits; returns their surnames. */
function learnTitle(title: string): Set<string> {
  const surnames = new Set<string>()
  if (!CREDIT_HINT.test(title)) return surnames
  for (const m of title.matchAll(CREDIT)) firstNames.add(m[1].toLowerCase())
  for (const m of title.matchAll(CREDIT_SEGMENT)) {
    const parts = nameParts(m[1].replace(/^Ma\.\s+/, ''))
    if (parts.length < 2 || parts.length > 4 || !parts.every((w) => PROPER.test(w))) continue
    for (const form of learnParts(parts)) surnames.add(form)
  }
  return surnames
}

/** Two to four words of letters, not a phrase ("felix librero"); else undefined. */
function plainName(tag: string): string[] | undefined {
  const t = tag.trim()
  if (NOT_A_NAME.test(` ${t} `)) return undefined
  const parts = nameParts(t)
  if (parts.length < 2 || parts.length > 4 || !parts.every((w) => LETTERS_ONLY.test(w)))
    return undefined
  return parts
}

function learnNames(): void {
  if (!nameSource) return
  const source = nameSource
  nameSource = undefined
  firstNames.clear()
  nameTokens.clear()
  surnameTags.clear()
  const docs: Iterable<NameSource> =
    typeof source === 'function' ? source() : [{ tags: [...source] }]
  const credited: [readonly string[], Set<string>][] = []
  for (const doc of docs) {
    const surnames = doc.title ? learnTitle(doc.title) : new Set<string>()
    for (const tag of doc.tags) for (const form of learnTag(tag.trim())) surnames.add(form)
    if (surnames.size) credited.push([doc.tags, surnames])
  }
  // A tag that ends with a surname its video credits is that person ("felix librero" beside
  // "FICS Chat with Sir Lex Librero"); so is the surname alone ("claudio").
  for (const [tags, surnames] of credited) {
    for (const tag of tags) {
      const word = tag.trim()
      if (!/\s/.test(word) && LETTERS_ONLY.test(word) && surnames.has(letters(word))) {
        surnameTags.add(letters(word))
        continue
      }
      const parts = plainName(tag)
      if (parts && surnames.has(letters(parts[parts.length - 1]))) learnParts(parts)
    }
  }
}

/** A first or last name seen in the catalog's person tags ("oruga"), whatever its case. */
export const isNameToken = (word: string) => {
  learnNames()
  return nameTokens.has(word.toLowerCase())
}

function remember(memo: Map<string, boolean>, tag: string, test: (tag: string) => boolean) {
  let known = memo.get(tag)
  if (known === undefined) {
    if (memo.size >= MEMO_MAX) memo.clear()
    known = test(tag)
    memo.set(tag, known)
  }
  return known
}

// Curated names (people.ts), compared like tags: whatever their case or punctuation.
let people: Set<string> | undefined

function looksLikePerson(tag: string): boolean {
  const t = tag.trim()
  if (isTitled(t)) return true
  people ??= new Set(PEOPLE.map(tagKey))
  if (people.has(tagKey(t))) return true
  if (!/\s/.test(t)) {
    learnNames()
    return surnameTags.has(letters(t))
  }
  const parts = nameParts(t)
  if (parts.length < 2 || parts.length > 4) return false
  // "Antolin Oreta III" is a person; "Region II" is not.
  if (NAME_SUFFIX.test(t) && parts.every((w) => LETTERS_ONLY.test(w))) return true
  learnNames()
  // Nothing but names the catalog knows, in any case ("Myra Oruga", "felix librero").
  const known = nameTokens.size > 0 && parts.every((w) => nameTokens.has(w.toLowerCase()))
  if (known && parts.every((w) => LETTERS_ONLY.test(w)) && !NOT_A_NAME.test(` ${t} `)) return true
  if (!parts.every((w) => WORD.test(w))) return false
  // "Firstname M. Lastname" with a middle initial (but not "PRAYERS N FAITH").
  if (MIDDLE_INITIAL.test(t)) return true
  // A known first name and a surname ("Agnes Rola"; a two-letter one like "An" is too often a word).
  return (
    parts.length <= 3 &&
    parts[0].length > 2 &&
    firstNames.has(parts[0].toLowerCase()) &&
    parts.every((w) => PROPER.test(w))
  )
}

/** A person's name (speaker, lecturer): titled, suffixed, or made of names the catalog knows. */
export const isPersonTag = (tag: string): boolean => remember(personMemo, tag, looksLikePerson)

// A titled name inside a longer tag: "An Interview with Dr. Judy Taguiwalo".
const MENTIONS_PERSON =
  /\s(Dr|Prof|Professor|Mr|Ms|Mrs|Atty|Engr|Hon|Dean|Chancellor|President|Mayor|Governor|Senator|Sen|Secretary|Ambassador|Usec)\.?\s+\p{Lu}\p{Ll}/u
// A title or a piece of one ("Flexible Learning: An Overview", "… | Dr. X", "and Pandemics …").
const TITLE_LIKE = /[|:?!…]|\.\.\.|^(?:and|or)\s/i
const MAX_TOPIC_WORDS = 6
// An instalment label: "FASTLearn Episode 62", "Tech Tips 33", "Plenary 3".
const INSTALMENT =
  /(?:^|\s)(?:episode|ep|part|pt|session|module|lesson|chapter|week|day|plenary|vol|volume|tips?)\.?\s*#?\d+$/i

function looksGeneric(tag: string): boolean {
  const key = tagKey(tag)
  if (key.length < 3 || /^\d+$/.test(key) || GENERIC.has(key)) return true
  const t = tag.trim()
  if (TITLE_LIKE.test(t) || INSTALMENT.test(t) || t.split(/\s+/).length > MAX_TOPIC_WORDS)
    return true
  return isPersonTag(t) || MENTIONS_PERSON.test(t)
}

/**
 * Housekeeping, brand, numeric, very short, title-like and person-name tags: never shown as topics
 * or chips.
 */
export const isGenericTag = (tag: string): boolean => remember(genericMemo, tag, looksGeneric)

// Faculties, offices, sponsors and people: fine as chips on a video, not as topics to browse by.
const ORG = new Set([
  'fmds',
  'fed',
  'fics',
  'ched',
  'cep',
  'pldt',
  'aspap',
  'eidr',
  'drdm',
  'iuptv',
  'upounetworksmultimediacenter',
  'bandalaria',
  'universityofthephilippines',
  'abscbn',
  'osa',
])

export const isOrgTag = (tag: string) => ORG.has(tagKey(tag)) || isPersonTag(tag)

// Small words stay lowercase inside a tag ("Health and Wellbeing", "Ugnayan ng Pahinungod").
const SMALL = new Set(
  'a an and as at by for from in into of on or the to via vs with sa ng mga'.split(' '),
)
// Acronyms and brands with a fixed spelling, by lowercase word.
const SPELLING: ReadonlyMap<string, string> = new Map(
  [
    'AI',
    'ALS',
    'ASEAN',
    'CHED',
    'COVID',
    'DepEd',
    'DRRM',
    'FICS',
    'FMDS',
    'GIS',
    'HIV',
    'ICT',
    'LGU',
    'LGUs',
    'MOOC',
    'MOOCs',
    'NGO',
    'NGOs',
    'ODeL',
    'OER',
    'OERs',
    'SDG',
    'SDGs',
    'UPOU',
  ].map((w) => [w.toLowerCase(), w] as [string, string]),
)
const COVID = /^covid-?19$/i
const EDGES = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u

const respell = (word: string): string | undefined => {
  if (COVID.test(word)) return 'COVID-19'
  return SPELLING.get(word.toLowerCase())
}

/**
 * Tidies a tag for display: all-lowercase and all-capitals tags get title case, small words stay
 * lowercase, and acronyms keep their spelling ("asean studies" → "ASEAN Studies").
 */
export function tidyTag(tag: string): string {
  const lower = tag === tag.toLowerCase()
  const words = tag.split(' ')
  const shouty =
    !lower && tag === tag.toUpperCase() && words.filter((w) => /\p{L}/u.test(w)).length > 1
  return words
    .map((word, i) => {
      const [, head = '', core = '', tail = ''] = EDGES.exec(word) ?? []
      const fixed = respell(core)
      if (fixed) return head + fixed + tail
      const small = core.toLowerCase()
      if (i > 0 && i < words.length - 1 && SMALL.has(small)) return head + small + tail
      if (lower) return head + core.replace(/^\p{Ll}/u, (c) => c.toUpperCase()) + tail
      if (shouty && core.length > 4) return head + core[0] + small.slice(1) + tail
      return word
    })
    .join(' ')
}

/** A video's tags as chips: housekeeping dropped, duplicates merged, tidied, capped. */
export function topicTags(tags: readonly string[], limit = 10): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    const key = tagKey(tag)
    if (!key || seen.has(key) || isGenericTag(tag)) continue
    seen.add(key)
    out.push(tidyTag(tag))
    if (out.length === limit) break
  }
  return out
}

/** Hand-picked subjects for "Popular topics", strongest first; each is a search query. */
export const POPULAR_TOPICS: readonly string[] = [
  'ODeL',
  'MOOCs',
  'ASEAN',
  'Agriculture',
  'Gender',
  'Health',
  'Communication',
  'Math',
  'Public management',
  'Ethics',
  'Filipino',
  'Climate change',
  'Environment',
  'Research',
  'Business',
  'Art',
]

/** Recurring programmes worth browsing as a set; each is a search query. */
export const POPULAR_SERIES: readonly string[] = [
  'FASTLearn',
  '100 Master Voices',
  'Akdang Buhay',
  "Let's Talk It Over",
  'OPEN Talk',
  'MicroLearning',
  'TechTips',
  'Student Orientation',
]
