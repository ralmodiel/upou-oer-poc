// Who speaks in a video, only where the source states it: the page's "Resource Persons" field, a
// credit in the title ("… | Prof. Alipio T. Garcia"), the How to cite author, or a curated name
// tag (written by scripts/speakers.mjs). Small, so it ships with the catalog; catalog.ts hands
// the names to tags.ts so they never show as topics.
import table from './speakers.json'

const speakers: Readonly<Record<string, readonly string[]>> = table
const NONE: readonly string[] = []

/** The video's speakers as the source writes them (honorifics kept); none when it names none. */
export const speakersOf = (id: string): readonly string[] =>
  Object.hasOwn(speakers, id) ? speakers[id] : NONE

/** Every speaker named in the catalog. */
export const allSpeakers = (): string[] => Object.values(speakers).flat()
