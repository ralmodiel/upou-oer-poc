import { useMemo, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import VideoGrid from '../components/VideoGrid'
import { GridHint, TEXT_LINK } from '../components/browse-ui'
import { DetailsContext, pageTarget } from '../components/details'
import { useDocumentTitle } from '../components/hooks'
import { SearchIcon } from '../components/icons'
import { slugOfCategory } from '../components/media'
import Button from '../components/ui/Button'
import Chip from '../components/ui/Chip'
import EmptyState from '../components/ui/EmptyState'
import SectionHeading from '../components/ui/SectionHeading'
import { getCategories, getCategory, searchVideos, videos } from '../data/catalog'
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

export default function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const raw = params.get('q') ?? ''
  const q = raw.trim()
  const slug = params.get('category') ?? ''
  const category = slug ? getCategory(slug) : undefined

  const all = useMemo(() => (q ? searchVideos(q, { limit: Infinity }) : []), [q])
  const results = useMemo(
    () => (category ? all.filter((v) => v.category === category.name) : all),
    [all, category],
  )
  // Result counts per collection, for the filter chips.
  const facets = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of all) counts.set(v.category, (counts.get(v.category) ?? 0) + 1)
    if (category && !counts.has(category.name)) counts.set(category.name, 0)
    return [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, n]) => ({ name, n, slug: slugOfCategory(name) }))
  }, [all, category])

  // Detail links keep the query and filter behind the dialog.
  const kept = new URLSearchParams(params)
  kept.delete('v')
  const base = kept.toString()
  const target = useMemo(() => pageTarget(base), [base])
  const filterLink = (categorySlug?: string) => {
    const next = new URLSearchParams(base)
    if (categorySlug) next.set('category', categorySlug)
    else next.delete('category')
    return `?${next}`
  }

  useDocumentTitle(q ? `“${q}” · Search · UPOU Networks` : 'Search · UPOU Networks')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const value = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : '/search')
  }

  const count = results.length
  const where = category ? ` in ${category.name}` : ''

  return (
    <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
      <SectionHeading
        as="h1"
        eyebrow="Search"
        className="break-words"
        title={
          q ? (
            <>
              Results for <span className="text-maroon">“{q}”</span>
            </>
          ) : (
            'Search every video'
          )
        }
        description={
          q
            ? undefined
            : 'Lectures, webinars and student work from UP Open University. Search by title, topic or tag, or start from a popular topic.'
        }
      />
      <form role="search" onSubmit={submit} className="mt-5 flex max-w-2xl gap-2">
        <label htmlFor="search-page-q" className="sr-only">
          Search videos
        </label>
        <input
          key={raw}
          id="search-page-q"
          name="q"
          type="search"
          defaultValue={raw}
          placeholder="Title, topic or tag"
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-pill border border-line bg-surface px-5 text-base text-ink placeholder:text-ink-3 focus:border-maroon"
        />
        <Button type="submit" icon={<SearchIcon />}>
          Search
        </Button>
      </form>

      {q ? (
        <>
          <p role="status" className="mt-5 text-sm text-ink-2">
            {count === 0
              ? `No videos${where} match “${q}”`
              : `${count} ${count === 1 ? 'video' : 'videos'}${where}`}
          </p>
          {all.length > 0 && (
            <nav aria-label="Filter by collection" className="mt-3">
              <ul
                role="list"
                className="-mx-(--gutter) flex gap-2 overflow-x-auto scroll-px-(--gutter) px-(--gutter) pb-1 scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
              >
                <li>
                  <Chip to={{ search: filterLink() }} active={!category} count={all.length}>
                    All
                  </Chip>
                </li>
                {facets.map((f) => (
                  <li key={f.name}>
                    <Chip
                      to={{ search: filterLink(f.slug) }}
                      active={category?.name === f.name}
                      count={f.n}
                    >
                      {f.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {count > 0 ? (
            <div className="mt-8">
              <GridHint />
              <DetailsContext value={target}>
                <VideoGrid videos={results} />
              </DetailsContext>
            </div>
          ) : (
            <>
              <EmptyState icon={<SearchIcon />} title="Nothing matched" compact>
                <p>
                  Check the spelling, try fewer or broader words
                  {category ? (
                    <>
                      , or{' '}
                      <Link to={{ search: filterLink() }} className={TEXT_LINK}>
                        search all collections
                      </Link>
                    </>
                  ) : (
                    ', or start from a topic below'
                  )}
                  .
                </p>
              </EmptyState>
              <Suggestions />
            </>
          )}
        </>
      ) : (
        <Suggestions />
      )}
    </div>
  )
}

function Suggestions() {
  const topics = useMemo(() => popularTags(12), [])
  const categories = getCategories()
  return (
    <div className="mt-10 space-y-8">
      <ChipGroup title="Popular topics">
        {topics.map((topic) => (
          <li key={topic}>
            <Chip to={`/search?q=${encodeURIComponent(topic)}`} active={false} title={topic}>
              {topic}
            </Chip>
          </li>
        ))}
      </ChipGroup>
      <ChipGroup
        title="Collections"
        link={{ to: '/collections', label: `All collections (${categories.length})` }}
      >
        {categories.slice(0, 12).map((c) => (
          <li key={c.slug}>
            <Chip to={`/collections/${c.slug}`} active={false} count={c.count}>
              {c.name}
            </Chip>
          </li>
        ))}
      </ChipGroup>
    </div>
  )
}

interface ChipGroupProps {
  title: string
  link?: { to: string; label: string }
  children: ReactNode
}

function ChipGroup({ title, link, children }: ChipGroupProps) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="font-display text-xl text-ink sm:text-2xl">{title}</h2>
        {link && (
          <Link to={link.to} className={`text-sm ${TEXT_LINK}`}>
            {link.label}
          </Link>
        )}
      </div>
      <ul role="list" className="mt-3 flex flex-wrap gap-2">
        {children}
      </ul>
    </section>
  )
}
