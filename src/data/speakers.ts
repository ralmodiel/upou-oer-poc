// Who speaks in a video, only where a source states it: the page's "Resource Persons" field, a
// credit in the title ("… | Prof. Alipio T. Garcia"), the How to cite author, then the YouTube
// title and description ("Speaker: Dr. X", a titled name under the title). Written by
// scripts/speakers.mjs, keyed by YouTube id (a third the size of the slugs). Small, so it ships
// with the catalog (packed by position, pack.ts); catalog.ts hands the names to tags.ts so they
// never show as topics.
import pack from 'virtual:catalog-pack'
import { tableOf } from './pack'

const speakers: Readonly<Record<string, readonly string[]>> = tableOf(pack, pack.speakers)
const NONE: readonly string[] = []

/** The video's speakers as the source writes them (honorifics kept); none when it names none. */
export const speakersOf = (youtubeId: string): readonly string[] =>
  Object.hasOwn(speakers, youtubeId) ? speakers[youtubeId] : NONE

/** Every speaker named in the catalog. */
export const allSpeakers = (): string[] => Object.values(speakers).flat()
