// Tag clean-up shared by the reel's topic chips, the quick look, the watch page and the search
// page's popular topics.

/** Ignores case, spaces and punctuation, so "Tech Tips" matches "TechTips". */
export const tagKey = (tag: string) => tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// WordPress housekeeping and brand tags that say nothing about the topic.
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
  'tvupupopenuniversity',
  'universityofthephilippinesupopenuniversity',
  'instructionalresources',
  'informative',
  'ltio',
])

// People are tagged with a title ("Dr. Myra Oruga", "aProf. Benjamin Gonzales", "Juan dela Cruz Jr.").
const HONORIFIC =
  /^(dr|prof|aprof|asst\.? ?prof|assoc\.? ?prof|mr|ms|mrs|atty|engr|arch|ar|sir|ma'am|hon|dean|fr|sr|br|rev|pres|dir|director|chancellor|vice chancellor)\.?\s+\S/i
const NAME_SUFFIX = /\s(jr|sr|ii|iii|iv)\.?$/i
// An initial, or "Ma." (María) before a first name.
const INITIAL = /^(?:[A-Z]|Ma)\.?$/
const PARTICLE = /^(de|dela|del|de la|la|los|las|van|von|da|di|du|san|santa|sta|sto)$/i
const WORD = /^\p{Lu}[\p{L}'’-]+$/u

// First and last names learned from the catalog's titled tags, so "Myra Oruga" is also a person.
const nameTokens = new Set<string>()

const nameParts = (tag: string) =>
  tag
    .replace(NAME_SUFFIX, '')
    .split(/\s+/)
    .filter((w) => w && !INITIAL.test(w) && !PARTICLE.test(w))

// A titled tag that reads like an office ("Director … and Information Service") teaches no names.
const NOT_A_NAME = /\s(and|of|for|the|in|on|at)\s|&/i
const MAX_NAME_PARTS = 5

/** Learns name tokens from titled tags; called whenever the catalog loads. */
export function registerNameTokens(tags: Iterable<string>) {
  nameTokens.clear()
  for (const tag of tags) {
    const t = tag.trim()
    if (!HONORIFIC.test(t)) continue
    const name = t.replace(HONORIFIC, (m) => m.slice(-1))
    const parts = nameParts(name)
    if (NOT_A_NAME.test(` ${name} `) || parts.length > MAX_NAME_PARTS) continue
    for (const w of parts) nameTokens.add(w.toLowerCase().replace(/[^\p{L}'’-]/gu, ''))
  }
}

/** A first or last name seen in the catalog's person tags ("oruga"), whatever its case. */
export const isNameToken = (word: string) => nameTokens.has(word.toLowerCase())

/** A person's name (speaker, lecturer): titled, suffixed, or made only of known name tokens. */
export const isPersonTag = (tag: string) => {
  const t = tag.trim()
  if (HONORIFIC.test(t)) return true
  const parts = nameParts(t)
  if (parts.length < 2 || parts.length > 4) return false
  // "Antolin Oreta III" is a person; "Region II" is not.
  if (NAME_SUFFIX.test(t) && parts.every((w) => /^[\p{L}'’-]+$/u.test(w))) return true
  if (!parts.every((w) => WORD.test(w))) return false
  // "Firstname M. Lastname" with a middle initial, or every word a known first/last name.
  if (/^\p{Lu}[\p{L}'’-]+\s\p{Lu}\.?\s\p{Lu}[\p{L}'’-]+$/u.test(t)) return true
  return nameTokens.size > 0 && parts.every((w) => nameTokens.has(w.toLowerCase()))
}

/** Housekeeping, brand, numeric, very short and person-name tags: never shown as topics or chips. */
export const isGenericTag = (tag: string) => {
  const key = tagKey(tag)
  return key.length < 3 || /^\d+$/.test(key) || GENERIC.has(key) || isPersonTag(tag)
}

// Faculties, offices, sponsors and people: fine as chips on a video, not as topics to browse by.
const ORG = new Set([
  'fmds',
  'facultyofmanagementanddevelopmentstudies',
  'facultyofeducation',
  'fed',
  'fics',
  'facultyofinformationandcommunicationstudies',
  'ched',
  'cep',
  'continuingeducationprogram',
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

/** Title-cases all-lowercase tags such as "open data"; mixed-case tags are left alone. */
export const tidyTag = (tag: string) =>
  tag === tag.toLowerCase() ? tag.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : tag

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
