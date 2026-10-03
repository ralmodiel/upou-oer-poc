import { useEffect, useMemo, useState } from 'react'
import { useNavigationType } from 'react-router'
import CollectionChips from '../components/CollectionChips'
import Featured from '../components/Featured'
import HistoryOff from '../components/HistoryOff'
import HowItWorks from '../components/HowItWorks'
import PageBand from '../components/PageBand'
import RecentlyViewed from '../components/RecentlyViewed'
import Recommended from '../components/Recommended'
import Section from '../components/Section'
import { onIdle, useFrozen } from '../components/browse-hooks'
import { GridHint, ManageLink } from '../components/browse-ui'
import { forYou, moreLikeThis, reasonsFor } from '../components/recs'
import { ChevronRightIcon } from '../components/icons'
import EmptyState from '../components/ui/EmptyState'
import LinkButton from '../components/ui/LinkButton'
import {
  getCategories,
  getFeatured,
  getLatest,
  getRows,
  getVideo,
  hasCleanPoster,
  videos,
} from '../data/catalog'
import { isEmptyProfile, useProfile, type Profile } from '../lib/history'
import { pickSources } from '../lib/privacy'
import { warmRecommenderAsync } from '../lib/recommend'
import { homeSeo, useSeo } from '../lib/seo'
import { historyAllowed, usePrefs, useWatchHistory, type HistoryEntry } from '../lib/storage'
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

let homeShownBefore = false

const loadType = () =>
  (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined)?.type

// Back / Forward within the app, or a reload, restores a scroll position: every section then
// renders its cards at once so the position lands on them. A fresh visit (the first load is a
// POP too) renders a section's cards as it nears the viewport.
function useRestoring() {
  const popped = useNavigationType() === 'POP'
  const [restoring] = useState(() => popped && (homeShownBefore || loadType() !== 'navigate'))
  useEffect(() => {
    homeShownBefore = true
  }, [])
  return restoring
}

interface HomeRecs {
  /** What the recs were computed for: card count and which parts of the profile were used. */
  key: string
  pending: boolean
  forYou: Video[]
  reasons: ReadonlyMap<string, string>
  /** The last watched video and titles like it. */
  because?: { video: Video; list: Video[]; reasons: ReadonlyMap<string, string> }
}

const NO_RECS: HomeRecs = { key: '', pending: false, forYou: [], reasons: new Map() }
// As last computed, so Back lands on the same layout at once (a fresh visit computes anew: the
// profile may have changed since; so does a privacy change).
let lastRecs: HomeRecs | null = null

// `shown`: every title already on the page (featured, also new, recently viewed, category rows),
// so no recommendation repeats one and the rows never wait for the recommender.
function computeRecs(
  profile: Profile,
  limit: number,
  shown: ReadonlySet<string>,
  key: string,
): HomeRecs {
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
    key,
    pending: false,
    forYou: picked,
    reasons: reasonsFor(picked, profile),
    because:
      watched && because.length
        ? { video: watched, list: because, reasons: becauseReasons }
        : undefined,
  }
}

// Personalised sections are computed once per visit, after the first paint: the recommender
// indexes the catalog in short slices first, and the grids render a frame later, so no task is long.
// An empty profile skips the recommender entirely. The profile is frozen at mount so saving a
// card here does not reshuffle the grids; turning history or searches off, or clearing them
// (Privacy and history), recomputes at once and never shows the old picks meanwhile.
function useHomeRecommendations(
  limit: number,
  shown: ReadonlySet<string>,
  restoring: boolean,
  enabled: boolean,
): HomeRecs {
  const live = useProfile()
  const key = `${limit}|${live.watched.length > 0}|${live.searches.length > 0}`
  const profile = useFrozen(live, key)
  // Every personal row switched off (Privacy and history): the recommender never runs.
  const empty = isEmptyProfile(profile) || !enabled
  const [recs, setRecs] = useState(() => (restoring && lastRecs?.key === key ? lastRecs : null))
  useEffect(() => {
    if (empty) return
    let frame = 0
    let cancelled = false
    const cancelIdle = onIdle(() => {
      void warmRecommenderAsync().then(() => {
        if (cancelled) return
        const next = computeRecs(profile, limit, shown, key)
        lastRecs = next
        frame = requestAnimationFrame(() => setRecs(next))
      })
    })
    return () => {
      cancelled = true
      cancelIdle()
      cancelAnimationFrame(frame)
    }
  }, [empty, profile, limit, shown, key])
  if (empty) return NO_RECS
  return recs?.key === key ? recs : { ...NO_RECS, key, pending: true }
}

// The collections with the newest videos, newest first, then a link to all of them: twelve rows
// that scroll sideways (Carousel; two cards to a page on phones, three at md, four from lg), each
// twelve to sixteen of the collection's newest videos and a "See all" tile when it holds more.
// "Recommended for you" and "Because you watched" are rows of twelve picks.
const SECTIONS = 12
const ROW_CARDS = 16
// A collection gets a row only when it fills three pages at four cards a page, so its See all tile
// never comes before the third page (smaller ones are a chip or "All collections" away).
const ROW_MIN = 12
// Videos read per collection: a row's sixteen and room for the titles shown above it (five
// featured, four also new, up to twenty recently viewed).
const ROW_POOL = ROW_CARDS + 29
const PICKS = 12
const NO_VIDEOS: Video[] = []

const without = (list: Video[], ids: ReadonlySet<string>) => {
  const rest = list.filter((v) => !ids.has(v.id))
  return rest.length ? rest : list
}

// A collection row leaves out the titles shown above it, unless that leaves fewer than ROW_MIN:
// then the newest of those top it up, the row kept in date order.
function rowVideos(list: readonly Video[], above: ReadonlySet<string>): Video[] {
  const rest = list.filter((v) => !above.has(v.id))
  if (rest.length >= ROW_MIN) return rest.slice(0, ROW_CARDS)
  const topUp = new Set(list.filter((v) => above.has(v.id)).slice(0, ROW_MIN - rest.length))
  return list.filter((v) => !above.has(v.id) || topUp.has(v))
}

// A long title is cut at a word boundary, without trailing punctuation.
function shortTitle(title: string, max = 48): string {
  if (title.length <= max) return title
  const cut = title.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,:;–—-]+$/, '')}…`
}

export default function BrowsePage() {
  // The first featured video with a clean poster, as in the static shell (link previews never
  // reach the page UI).
  const first = getFeatured().find(hasCleanPoster) ?? getFeatured()[0]
  useSeo(homeSeo(videos.length, getCategories().length, first?.poster ?? first?.backdrop))
  const entries = useShownHistory()
  const [prefs] = usePrefs()
  const historyOn = historyAllowed(prefs)
  const showRecent = historyOn && prefs.recentlyViewed
  const showBecause = historyOn && prefs.becauseYouWatched
  const recent = useMemo(
    () =>
      showRecent ? entries.map((e) => getVideo(e.id)).filter((v) => v !== undefined) : NO_VIDEOS,
    [entries, showRecent],
  )
  // Catalog getters are memoized, so these identities are stable between renders.
  const featured = getFeatured()
  const alsoNew = useMemo(() => {
    const shown = new Set(featured.map((v) => v.id))
    return getLatest(12)
      .filter((v) => !shown.has(v.id))
      .slice(0, 4)
  }, [featured])
  // A title already above (featured, also new, recently viewed) is left out of its category
  // row, which takes the next newest instead.
  const rows = getRows(ROW_POOL)
  const above = useMemo(
    () => new Set([...featured, ...alsoNew, ...recent].map((v) => v.id)),
    [featured, alsoNew, recent],
  )
  const shownRows = useMemo(
    () =>
      rows
        .filter((row) => row.count >= ROW_MIN)
        .slice(0, SECTIONS)
        .map((row) => ({ ...row, videos: rowVideos(row.videos, above) })),
    [above, rows],
  )
  const shown = useMemo(
    () =>
      new Set(
        [...featured, ...alsoNew, ...recent, ...shownRows.flatMap((r) => r.videos)].map(
          (v) => v.id,
        ),
      ),
    [featured, alsoNew, recent, shownRows],
  )
  const restoring = useRestoring()
  const recs = useHomeRecommendations(PICKS, shown, restoring, prefs.recommendations || showBecause)
  // Recs computed before the latest watch (Back from the player) may hold a title now shown above:
  // never repeat one across the top rows (unless that would leave a row bare: a tiny catalog).
  const forYouList = useMemo(() => without(recs.forYou, above), [recs.forYou, above])
  const becauseList = useMemo(
    () =>
      without(recs.because?.list ?? [], new Set([...above, ...forYouList.map((v) => v.id)])).slice(
        0,
        PICKS,
      ),
    [recs.because, above, forYouList],
  )

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

  return (
    <>
      <GridHint />
      <Intro />
      <Featured videos={featured} alsoNew={alsoNew} />
      <HowItWorks />
      {/* Every third section is a tinted band (browse.css). */}
      <div className="home-bands">
        {prefs.recommendations && (
          <Recommended
            row="recommended"
            title="Recommended for you"
            description={
              <>
                Picked from what you {pickSources(prefs)} in this browser. <ManageLink />
              </>
            }
            videos={forYouList}
            reasons={recs.reasons}
            pending={recs.pending}
            cards={PICKS}
          />
        )}
        <RecentlyViewed videos={recent} />
        <HistoryOff />
        <CollectionChips />
        {showBecause && recs.because && becauseList.length > 0 && (
          <Recommended
            row="because"
            title={`Because you watched “${shortTitle(recs.because.video.title)}”`}
            description={
              <>
                Titles close to the one you watched last. <ManageLink />
              </>
            }
            videos={becauseList}
            reasons={recs.because.reasons}
            cards={PICKS}
          />
        )}
        {shownRows.map((row) => (
          <Section key={row.id} row={row} eager={restoring} />
        ))}
        <MoreCollections shown={shownRows.length} />
      </div>
    </>
  )
}

/** After the capped sections: the way to every collection (the chips above list them too). */
function MoreCollections({ shown }: { shown: number }) {
  const total = getCategories().length
  const more = total - shown
  return (
    <section aria-label="More collections" className="px-(--gutter) py-10 text-center sm:py-12">
      <p className="text-sm text-ink-2">
        {more > 0
          ? `${more} more ${more === 1 ? 'collection' : 'collections'}, plus everything in these.`
          : 'Every collection, with all its videos.'}
      </p>
      {/* A full-width row for the remote: ↓ from any column of the last grid lands here. */}
      <div className="mt-4">
        <LinkButton to="/collections" size="lg" data-spatial="wide" iconEnd={<ChevronRightIcon />}>
          All {total} collections
        </LinkButton>
      </div>
    </section>
  )
}

/** Visible page title on the maroon band: the full meaning of OER, for first-time visitors. */
function Intro() {
  return (
    <PageBand
      tone="maroon"
      title="Open Educational Resources from the University of the Philippines Open University"
      titleClassName="text-xl leading-snug sm:text-2xl lg:text-[1.75rem]"
      compact
    >
      {videos.length.toLocaleString('en')} free videos: lectures, webinars and student work. Browse
      by collection or search everything.
    </PageBand>
  )
}
