import { useEffect, useMemo, useState } from 'react'
import { useNavigationType } from 'react-router'
import CollectionChips from '../components/CollectionChips'
import ContinueWatching from '../components/ContinueWatching'
import Featured from '../components/Featured'
import HowItWorks from '../components/HowItWorks'
import Section from '../components/Section'
import { GridHint } from '../components/browse-ui'
import { useDocumentTitle } from '../components/hooks'
import EmptyState from '../components/ui/EmptyState'
import { getFeatured, getLatest, getRows, getVideo, videos } from '../data/catalog'
import { useWatchHistory, type HistoryEntry } from '../lib/storage'
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

export default function BrowsePage() {
  useDocumentTitle('UPOU Networks · Open educational videos')
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
  const rows = getRows()
  const sectionCount = useSectionCount(rows.length)

  if (!videos.length) {
    return (
      <div className="px-(--gutter) py-16">
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
      <GridHint />
      <HowItWorks />
      <Featured videos={featured} alsoNew={alsoNew} />
      <div className="mt-10 space-y-2 sm:mt-12">
        <ContinueWatching videos={recent} />
        <CollectionChips />
        {rows.slice(0, sectionCount).map((row) => (
          <Section key={row.id} row={row} />
        ))}
      </div>
    </>
  )
}
