import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import VideoGrid from '../components/VideoGrid'
import { GridHint } from '../components/browse-ui'
import { useDocumentTitle } from '../components/hooks'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import LinkButton from '../components/ui/LinkButton'
import SectionHeading from '../components/ui/SectionHeading'
import { getCategory, getCategoryVideos, type CategorySort } from '../data/catalog'

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

  useDocumentTitle(`${category?.name ?? 'Collection not found'} · Collections · UPOU OER`)

  // After "Load more", focus the first new card so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (focusAt.current < 0) return
    grid.current?.querySelectorAll<HTMLElement>('[data-card-link]')[focusAt.current]?.focus()
    focusAt.current = -1
  })

  const crumbs = [
    { label: 'Browse', to: '/' },
    { label: 'Collections', to: '/collections' },
  ]

  if (!category) {
    return (
      <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
        <Breadcrumbs items={[...crumbs, { label: 'Not found' }]} />
        <SectionHeading
          as="h1"
          className="mt-4"
          title="Collection not found"
          description="There is no collection at this address. It may have been renamed."
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton to="/collections">All collections</LinkButton>
          <LinkButton to="/" variant="secondary">
            Browse videos
          </LinkButton>
        </div>
      </div>
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
    <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
      <Breadcrumbs items={[...crumbs, { label: category.name }]} />
      <SectionHeading
        as="h1"
        className="mt-4"
        title={category.name}
        description={`${all.length} ${all.length === 1 ? 'video' : 'videos'}`}
      >
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
      </SectionHeading>
      <GridHint />
      <div ref={grid} className="mt-8">
        <VideoGrid videos={visible} showCategory={false} />
      </div>
      <div className="mt-10 flex flex-col items-center gap-3">
        <p role="status" className="text-sm text-ink-3">
          Showing {visible.length} of {all.length}
        </p>
        {visible.length < all.length && (
          <Button variant="secondary" onClick={loadMore}>
            Load {Math.min(PAGE_SIZE, all.length - visible.length)} more
          </Button>
        )}
      </div>
    </div>
  )
}
