import { useEffect, useMemo, useState } from 'react'
import { useNavigationType } from 'react-router'
import CollectionChips from '../components/CollectionChips'
import ContinueWatching from '../components/ContinueWatching'
import Featured from '../components/Featured'
import HowItWorks from '../components/HowItWorks'
import Recommended from '../components/Recommended'
import Section from '../components/Section'
import { onIdle, useFrozen, useMediaQuery } from '../components/browse-hooks'
import { GridHint } from '../components/browse-ui'
import { heroImageOf } from '../components/media'
import { forYou, moreLikeThis, reasonsFor } from '../components/recs'
import EmptyState from '../components/ui/EmptyState'
import LinkButton from '../components/ui/LinkButton'
import { getCategories, getFeatured, getLatest, getRows, getVideo, videos } from '../data/catalog'
import { isEmptyProfile, useProfile, type Profile } from '../lib/history'
import { homeSeo, useSeo } from '../lib/seo'
import { useWatchHistory, type HistoryEntry } from '../lib/storage'
import type { Video } from '../types'
import '../components/browse.css'

// History as last rendered here. Coming Back from the player, the first frame reuses it so
// the restored scroll position matches the old layout; the new strip then appears above
// and browser scroll anchoring keeps the view in place.
let lastShown: readonly HistoryEntry[] | null = null

const sameIds = (a: readonly HistoryEntry[], b: readonly HistoryEntry[]) =>
  a.length === b.length && a.every((e, i) => e.id === b[i]?.id)

function useShownHistory() {
  const { entries } = useWatchHistory()
  const popped = useNavigationType() === 'POP'
  const [held, setHeld] = useState(() =>
    popped && lastShown && !sameIds(lastShown, entries) ? lastShown : null,
  )
  useEffect(() => {
    if (!held) return
    const frame = requestAnimationFrame(() => setHeld(null))
    return () => cancelAnimationFrame(frame)
  }, [held])
  const shown = held ?? entries
  useEffect(() => {
    lastShown = shown
  }, [shown])
  return shown
}

const SECTIONS_PER_FRAME = 4

// The first paint carries the top sections; the rest follow a few per frame so the home page
// is interactive sooner. Coming Back (POP) everything renders at once, so the restored scroll
// position lands on content.
function useSectionCount(total: number) {
  const popped = useNavigationType() === 'POP'
  const [count, setCount] = useState(() => (popped ? total : SECTIONS_PER_FRAME))
  useEffect(() => {
    if (count >= total) return
    const frame = requestAnimationFrame(() => setCount((c) => c + SECTIONS_PER_FRAME))
    return () => cancelAnimationFrame(frame)
  }, [count, total])
  return Math.min(count, total)
}

interface HomeRecs {
  limit: number
  pending: boolean
  forYou: Video[]
  reasons: ReadonlyMap<string, string>
  /** The last watched video and titles like it. */
  because?: { video: Video; list: Video[]; reasons: ReadonlyMap<string, string> }
}

const NO_RECS: HomeRecs = { limit: 0, pending: false, forYou: [], reasons: new Map() }
// As last computed, so Back lands on the same layout at once.
let lastRecs: HomeRecs | null = null

// `shown`: every title already on the page (featured, also new, continue watching, category rows),
// so no recommendation repeats one and the rows never wait for the recommender.
function computeRecs(profile: Profile, limit: number, shown: ReadonlySet<string>): HomeRecs {
  // Only when nothing unshown matches (a tiny catalog) may a section repeat a shown title.
  const orShown = (list: Video[], withShown: () => Video[]) => (list.length ? list : withShown())
  const picked = orShown(forYou(profile, limit, shown), () => forYou(profile, limit))
  const watched = getVideo(profile.watched[0]?.id)
  // Neither watched nor already recommended above (nor shown, as far as possible).
  const seen = [...picked.map((v) => v.id), ...profile.watched.map((e) => e.id)]
  const because = watched
    ? orShown(moreLikeThis(watched, { profile, limit, exclude: [...shown, ...seen] }), () =>
        moreLikeThis(watched, { profile, limit, exclude: seen }),
      )
    : []
  // Under the "Because you watched …" heading that reason says nothing: the collection eyebrow
  // takes over on those cards.
  const becauseReasons = new Map(
    [...reasonsFor(because, profile, watched)].filter(
      ([, r]) => !r.startsWith('Because you watched'),
    ),
  )
  return {
    limit,
    pending: false,
    forYou: picked,
    reasons: reasonsFor(picked, profile),
    because:
      watched && because.length
        ? { video: watched, list: because, reasons: becauseReasons }
        : undefined,
  }
}

// Personalised sections are computed once per visit, after the first paint (the recommender
// indexes the catalog on first use); the grids render in a later frame so neither task is long.
// An empty profile skips the recommender entirely. The profile is frozen at mount so saving a
// card here does not reshuffle the grids.
function useHomeRecommendations(limit: number, shown: ReadonlySet<string>): HomeRecs {
  const profile = useFrozen(useProfile(), limit)
  const empty = isEmptyProfile(profile)
  const [recs, setRecs] = useState(() => (lastRecs?.limit === limit ? lastRecs : null))
  useEffect(() => {
    if (empty) return
    let frame = 0
    const cancelIdle = onIdle(() => {
      const next = computeRecs(profile, limit, shown)
      lastRecs = next
      frame = requestAnimationFrame(() => setRecs(next))
    })
    return () => {
      cancelIdle()
      cancelAnimationFrame(frame)
    }
  }, [empty, profile, limit, shown])
  if (empty) return NO_RECS
  return recs ?? { ...NO_RECS, limit, pending: true }
}

// Phones: the strongest collections only, four cards each, then a link to the rest.
const PHONE_SECTIONS = 7
const PHONE_CARDS = 4
const CARDS = 8
const MIN_ROW = 3

const shortTitle = (title: string) => (title.length > 48 ? `${title.slice(0, 46).trim()}…` : title)

export default function BrowsePage() {
  const first = getFeatured()[0]
  useSeo(homeSeo(videos.length, getCategories().length, first && heroImageOf(first)))
  const entries = useShownHistory()
  const recent = useMemo(
    () => entries.map((e) => getVideo(e.id)).filter((v) => v !== undefined),
    [entries],
  )
  // Catalog getters are memoized, so these identities are stable between renders.
  const featured = getFeatured()
  const alsoNew = useMemo(() => {
    const shown = new Set(featured.map((v) => v.id))
    return getLatest(12)
      .filter((v) => !shown.has(v.id))
      .slice(0, 4)
  }, [featured])
  const wide = useMediaQuery('(min-width: 48rem)')
  const cards = wide ? CARDS : PHONE_CARDS
  // A title already above (featured, also new, continue watching) is left out of its category
  // row, which takes the next newest instead.
  const rows = getRows(CARDS * 2)
  const shownRows = useMemo(() => {
    const above = new Set([...featured, ...alsoNew, ...recent].map((v) => v.id))
    return (wide ? rows : rows.slice(0, PHONE_SECTIONS)).map((row) => {
      const rest = row.videos.filter((v) => !above.has(v.id))
      // A small collection shown almost entirely above keeps its own list rather than going bare.
      return { ...row, videos: (rest.length >= MIN_ROW ? rest : row.videos).slice(0, cards) }
    })
  }, [featured, alsoNew, recent, rows, wide, cards])
  const shown = useMemo(
    () =>
      new Set(
        [...featured, ...alsoNew, ...recent, ...shownRows.flatMap((r) => r.videos)].map(
          (v) => v.id,
        ),
      ),
    [featured, alsoNew, recent, shownRows],
  )
  const recs = useHomeRecommendations(cards, shown)
  const sectionCount = useSectionCount(shownRows.length)

  if (!videos.length) {
    return (
      <div className="px-(--gutter) py-16">
        <h1 className="sr-only">Browse</h1>
        <EmptyState title="No videos yet">
          <p>The UPOU OER catalog is being prepared. Please check back soon.</p>
        </EmptyState>
      </div>
    )
  }

  const collections = getCategories().length
  return (
    <>
      <GridHint />
      <Featured videos={featured} alsoNew={alsoNew} intro={<Intro />} />
      <HowItWorks />
      <div className="space-y-2">
        <Recommended
          title="Recommended for you"
          description="Picked from what you watched, searched and saved in this browser."
          videos={recs.forYou}
          reasons={recs.reasons}
          pending={recs.pending}
          cards={cards}
        />
        <ContinueWatching videos={recent} />
        <CollectionChips />
        {recs.because && (
          <Recommended
            title={`Because you watched “${shortTitle(recs.because.video.title)}”`}
            description="Titles close to the one you watched last."
            videos={recs.because.list}
            reasons={recs.because.reasons}
            cards={cards}
          />
        )}
        {shownRows.slice(0, sectionCount).map((row) => (
          <Section key={row.id} row={row} />
        ))}
        {!wide && sectionCount === shownRows.length && (
          <section
            aria-label="More collections"
            className="border-t border-line px-(--gutter) py-10 text-center"
          >
            <p className="text-sm text-ink-2">
              {rows.length - shownRows.length} more collections, plus everything in these.
            </p>
            <LinkButton to="/collections" className="mt-4">
              All {collections} collections
            </LinkButton>
          </section>
        )}
      </div>
    </>
  )
}

/** Visible page title: the full meaning of OER, for first-time visitors (and search engines). */
function Intro() {
  return (
    <div className="px-(--gutter) pt-6 sm:pt-8">
      <h1 className="font-display text-xl leading-snug text-balance text-ink sm:text-2xl">
        Open Educational Resources from the University of the Philippines Open University
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        {videos.length.toLocaleString('en')} free videos: lectures, webinars and student work.
        Browse by collection or search everything.
      </p>
    </div>
  )
}
