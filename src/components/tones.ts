// Brand colour of each collection: its chip dot, the top bar of its collection card and the band of
// its page header. The four UP tones go round in catalog order, so neighbours never share one.
import { getCategories, type Category } from '../data/catalog'

export type Tone = 'maroon' | 'forest' | 'gold' | 'charcoal'

const ORDER: Tone[] = ['maroon', 'forest', 'gold', 'charcoal']

/** A solid band: fill, text on it (paper, or charcoal on gold), its rule and quieter text. */
export const BAND: Record<Tone, { fill: string; text: string; rule: string; muted: string }> = {
  maroon: {
    fill: 'bg-band-maroon',
    text: 'text-on-band band-focus',
    rule: 'bg-band-gold',
    muted: 'text-on-band/85',
  },
  forest: {
    fill: 'bg-band-forest',
    text: 'text-on-band band-focus',
    rule: 'bg-band-gold',
    muted: 'text-on-band/85',
  },
  gold: {
    fill: 'bg-band-gold',
    text: 'text-charcoal [&_:focus-visible]:outline-charcoal',
    rule: 'bg-charcoal',
    muted: 'text-charcoal/90',
  },
  charcoal: {
    fill: 'bg-band-charcoal',
    text: 'text-on-band band-focus',
    rule: 'bg-band-gold',
    muted: 'text-on-band/85',
  },
}

/** Small marks (chip dots, card bars): band colours, lighter in dark mode so they stay visible. */
export const MARK: Record<Tone, string> = {
  maroon: 'bg-band-maroon dark:bg-maroon',
  forest: 'bg-band-forest dark:bg-forest',
  gold: 'bg-band-gold',
  charcoal: 'bg-band-charcoal dark:bg-ink-3',
}

// Keyed by the memoized list, so a catalog swap (tests) starts over.
const tones = new WeakMap<readonly Category[], Map<string, Tone>>()

/** The tone of a collection by slug (maroon for an unknown one). */
export function toneOf(slug: string): Tone {
  const categories = getCategories()
  let map = tones.get(categories)
  if (!map) {
    map = new Map(categories.map((c, i) => [c.slug, ORDER[i % ORDER.length]]))
    tones.set(categories, map)
  }
  return map.get(slug) ?? 'maroon'
}
