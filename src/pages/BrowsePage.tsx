import { useEffect, useMemo, useState } from 'react'
import { useNavigationType } from 'react-router'
import EmptyState from '../components/EmptyState'
import Hero from '../components/Hero'
import Row from '../components/Row'
import { useDocumentTitle } from '../components/hooks'
import { featured, getRows, getVideo, latest, similarTo, videos } from '../data/catalog'
import { useMyList, useWatchHistory, type HistoryEntry } from '../lib/storage'

// History as last rendered here. Coming Back from the player, the first frame reuses it so
// the restored scroll position matches the old layout; the new rows then slide in above
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

export default function BrowsePage() {
  useDocumentTitle('UPOU Networks')
  const entries = useShownHistory()
  const { ids } = useMyList()

  // Memoized so the memoized rows skip re-rendering when only ?v= changes.
  const recent = useMemo(
    () => entries.map((e) => getVideo(e.id)).filter((v) => v !== undefined),
    [entries],
  )
  const saved = useMemo(() => ids.map((id) => getVideo(id)).filter((v) => v !== undefined), [ids])
  const lastWatched = recent[0]
  const because = useMemo(() => (lastWatched ? similarTo(lastWatched) : []), [lastWatched])
  // A few titles per collection keep the page light; "See all" opens the rest. Memoized in the catalog.
  const rows = getRows()

  if (!videos.length) {
    return (
      <div className="px-(--gutter) pt-24">
        <h1 className="sr-only">Browse</h1>
        <EmptyState title="No videos yet">
          <p>The UPOU Networks catalog is being prepared. Please check back soon.</p>
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <h1 className="sr-only">Browse UPOU Networks videos</h1>
      <Hero videos={featured} />
      <div className="relative z-10 -mt-14 space-y-2 sm:-mt-24 sm:space-y-4 lg:-mt-32 lg:space-y-6">
        <Row title="Recently Watched" videos={recent} />
        <Row title="My List" videos={saved} />
        <Row title="New on UPOU Networks" videos={latest} />
        {lastWatched && <Row title={`Because you watched ${lastWatched.title}`} videos={because} />}
        {rows.map((row) => (
          <Row
            key={row.id}
            title={row.title}
            videos={row.videos}
            seeAll={row.count > row.videos.length ? `/collections/${row.slug}` : undefined}
            total={row.count}
          />
        ))}
      </div>
    </>
  )
}
