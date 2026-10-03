import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { MosaicBackdrop } from '../components/Backdrop'
import PageBand from '../components/PageBand'
import VideoGrid from '../components/VideoGrid'
import { GridHint } from '../components/browse-ui'
import { toneOf } from '../components/tones'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import NotFound from '../components/ui/NotFound'
import {
  GENERAL_CATEGORY,
  getCategory,
  getCategoryVideos,
  type CategorySort,
} from '../data/catalog'
import { collectionSeo, pageTitle, useSeo } from '../lib/seo'
import { focusAndReveal } from '../lib/spatial'

const PAGE_SIZE = 24
const SORTS: { value: CategorySort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'A–Z' },
]
const isSort = (s: string | null): s is CategorySort => SORTS.some((o) => o.value === s)

// How far each collection was expanded, so Back from the player shows the same page length.
const expanded = new Map<string, number>()

export default function CategoryPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const sortParam = params.get('sort')
  const sort: CategorySort = isSort(sortParam) ? sortParam : 'newest'
  const category = getCategory(slug)
  const key = `${slug}:${sort}`
  const [state, setState] = useState<{ key: string; shown: number } | null>(null)
  const shown = state?.key === key ? state.shown : (expanded.get(key) ?? PAGE_SIZE)
  const grid = useRef<HTMLDivElement>(null)
  const focusAt = useRef(-1)

  useSeo(
    category
      ? collectionSeo(category, getCategoryVideos(slug))
      : {
          title: pageTitle('Collection not found'),
          description: 'There is no collection at this address.',
          noindex: true,
        },
  )

  // After "Load more", focus the first new card (scrolled to the middle of the screen) so
  // keyboard and screen-reader users land on it.
  useEffect(() => {
    if (focusAt.current < 0) return
    const link = grid.current?.querySelectorAll<HTMLElement>('[data-card-link]')[focusAt.current]
    if (link) focusAndReveal(link)
    focusAt.current = -1
  })

  const crumbs = [
    { label: 'Browse', to: '/' },
    { label: 'Collections', to: '/collections' },
  ]

  if (!category) {
    return (
      <NotFound
        title="Collection not found"
        crumbs={[...crumbs, { label: 'Not found' }]}
        actions={[
          { label: 'All collections', to: '/collections' },
          { label: 'Browse videos', to: '/' },
        ]}
      >
        There is no collection at this address. It may have been renamed.
      </NotFound>
    )
  }

  const all = getCategoryVideos(slug, sort)
  const visible = all.slice(0, shown)
  const sortLink = (value: CategorySort) => {
    const next = new URLSearchParams(params)
    next.delete('v')
    if (value === 'newest') next.delete('sort')
    else next.set('sort', value)
    return `?${next}`
  }
  const loadMore = () => {
    const next = Math.min(all.length, shown + PAGE_SIZE)
    expanded.set(key, next)
    focusAt.current = shown
    setState({ key, shown: next })
  }

  return (
    <>
      <div className="px-(--gutter) pt-6 pb-4 sm:pt-8">
        <Breadcrumbs items={[...crumbs, { label: category.name }]} />
      </div>
      {/* The collection's colour band, with its newest stills beside it (never under it). */}
      <PageBand
        tone={toneOf(slug)}
        eyebrow="Collection"
        title={category.name}
        aside={<MosaicBackdrop videos={getCategoryVideos(slug).slice(0, 12)} scrim="bg-paper/30" />}
      >
        {all.length} {all.length === 1 ? 'video' : 'videos'}
        {category.name === GENERAL_CATEGORY ? ' without a subject category' : ''}
      </PageBand>
      <div className="px-(--gutter) pt-6 pb-16">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span aria-hidden="true" className="text-sm text-ink-3">
            Sort by
          </span>
          <div
            role="group"
            aria-label="Sort by"
            className="inline-flex rounded-pill border border-line bg-surface p-0.5"
          >
            {SORTS.map((o) => (
              <Link
                key={o.value}
                to={{ search: sortLink(o.value) }}
                replace
                preventScrollReset
                aria-current={o.value === sort ? 'true' : undefined}
                className="inline-flex h-10 items-center rounded-pill px-3.5 text-sm font-medium text-ink-2 transition-colors duration-200 hover:text-ink aria-[current]:bg-ink aria-[current]:text-paper"
              >
                {o.label}
              </Link>
            ))}
          </div>
        </div>
        <GridHint />
        <div ref={grid} className="mt-6">
          <VideoGrid videos={visible} showCategory={false} />
        </div>
        <div className="mt-10 flex flex-col items-center gap-3">
          <p role="status" className="text-sm text-ink-3">
            Showing {visible.length} of {all.length}
          </p>
          {visible.length < all.length && (
            <Button variant="secondary" onClick={loadMore} data-spatial="wide">
              Load {Math.min(PAGE_SIZE, all.length - visible.length)} more
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
