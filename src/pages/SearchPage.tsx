import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import EmptyState from '../components/EmptyState'
import VideoGrid from '../components/VideoGrid'
import { DetailsContext, pageTarget } from '../components/details'
import { useDocumentTitle } from '../components/hooks'
import { SearchIcon } from '../components/icons'
import { categories, searchVideos, videos } from '../data/catalog'
import { isGenericTag, tagKey } from '../lib/tags'

/** Most used tags, de-duplicated by case and by series prefix ("TechTips Series 1"). */
function popularTags(limit: number) {
  const counts = new Map<string, { tag: string; n: number }>()
  for (const video of videos) {
    for (const raw of video.tags) {
      const tag = raw.trim()
      const key = tagKey(tag)
      if (!tag || tag.length > 28 || isGenericTag(tag)) continue
      const entry = counts.get(key) ?? { tag, n: 0 }
      entry.n++
      counts.set(key, entry)
    }
  }
  const picked: string[] = []
  for (const { tag } of [...counts.values()].sort((a, b) => b.n - a.n)) {
    if (picked.some((p) => tagKey(tag).startsWith(tagKey(p)))) continue
    picked.push(tag)
    if (picked.length === limit) break
  }
  return picked
}

const TOPICS = popularTags(12)

export default function SearchPage() {
  const [params] = useSearchParams()
  const raw = params.get('q') ?? ''
  const q = raw.trim()
  const results = useMemo(() => searchVideos(q), [q])
  const target = useMemo(
    () => pageTarget(raw ? new URLSearchParams({ q: raw }).toString() : ''),
    [raw],
  )
  useDocumentTitle(q ? `“${q}” · Search · UPOU Networks` : 'Search · UPOU Networks')

  return (
    <div className="px-(--gutter) pt-32 pb-8 sm:pt-28">
      {q ? (
        <>
          <h1 className="text-2xl font-bold tracking-tight break-words text-white sm:text-3xl">
            Results for <span className="text-brand-300">“{q}”</span>
          </h1>
          <p role="status" className="mt-1 text-sm text-neutral-400">
            {results.length === 0
              ? 'No matches'
              : `${results.length} ${results.length === 1 ? 'title' : 'titles'}`}
          </p>
          {results.length > 0 ? (
            <div className="mt-8">
              <DetailsContext value={target}>
                <VideoGrid videos={results} />
              </DetailsContext>
            </div>
          ) : (
            <>
              <EmptyState
                icon={<SearchIcon className="size-7" />}
                title="Nothing matched your search"
              >
                <p>
                  Check the spelling, try fewer or broader words, or explore one of these instead.
                </p>
              </EmptyState>
              <QuickSearches />
            </>
          )}
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Search</h1>
          <p className="mt-2 max-w-xl text-sm text-neutral-400 sm:text-base">
            Find lectures, webinars and student works from UP Open University by title, topic or
            tag.
          </p>
          <QuickSearches />
        </>
      )}
    </div>
  )
}

function QuickSearches() {
  return (
    <div className="mt-10 space-y-8">
      <ChipGroup title="Browse by category" terms={categories} />
      <ChipGroup title="Popular topics" terms={TOPICS} />
    </div>
  )
}

function ChipGroup({ title, terms }: { title: string; terms: readonly string[] }) {
  if (!terms.length) return null
  return (
    <section>
      <h2 className="text-xs font-semibold tracking-[0.15em] text-neutral-400 uppercase">
        {title}
      </h2>
      <ul role="list" className="mt-3 flex flex-wrap gap-2">
        {terms.map((term) => (
          <li key={term} className="max-w-full">
            <Link
              to={`/search?q=${encodeURIComponent(term)}`}
              title={term}
              className="block max-w-full truncate rounded-full bg-ink-800 px-4 py-2 text-sm text-neutral-200 ring-1 ring-white/10 transition duration-200 ease-cinematic hover:bg-brand-600/25 hover:text-white hover:ring-brand-400 sm:max-w-80"
            >
              {term}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
