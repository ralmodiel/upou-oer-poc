import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from 'react-router'
import { useSearchSuggestions } from '../components/SearchSuggest'
import VideoGrid from '../components/VideoGrid'
import { GridHint, TEXT_LINK } from '../components/browse-ui'
import { DetailsContext, pageTarget } from '../components/details'
import { useRovingRow } from '../components/hooks'
import { SearchIcon } from '../components/icons'
import { slugOfCategory } from '../components/media'
import { MARK, toneOf } from '../components/tones'
import Button from '../components/ui/Button'
import Chip from '../components/ui/Chip'
import EmptyState from '../components/ui/EmptyState'
import SectionHeading from '../components/ui/SectionHeading'
import {
  getCategories,
  getCategory,
  searchCatalog,
  videos,
  type SearchResults,
} from '../data/catalog'
import { useSearchHistory } from '../lib/history'
import { searchSeo, useSeo } from '../lib/seo'
import { focusSearch } from '../lib/shortcuts'
import { searchPath } from '../lib/suggest'
import { isGenericTag, isOrgTag, POPULAR_SERIES, POPULAR_TOPICS, tagKey } from '../lib/tags'

const PAGE_SIZE = 24
// Filter chips shown before "All n collections" (about two rows on a laptop).
const FACETS_SHOWN = 7
// A query counts as committed (for recommendations) once it has rested this long.
const COMMIT_MS = 1200
// How far each query was expanded, so Back from the player shows the same page length.
const expanded = new Map<string, number>()
// The page title takes focus after a submitted search (this page's field on phones, the header's).
const RESULTS_HEADING = 'search-results'
const SUBMITTED = { submitted: true }
const NO_RESULTS: SearchResults = { videos: [], exact: 0 }
// "Did you mean" is offered up to this many results as typed, when the fix finds clearly more.
const FEW_RESULTS = 3
const clearlyMore = (fixed: number, typed: number) => (typed ? fixed >= 3 * typed : fixed > 0)

// As typed: near spellings don't count.
const hasResults = (query: string) => searchCatalog(query, { limit: 1 }).exact > 0

/**
 * Curated subjects that exist in this catalog, topped up with the most used tags
 * (de-duplicated by case and by series prefix: "TechTips Series 1").
 */
function popularTags(limit: number) {
  const picked = POPULAR_TOPICS.filter(hasResults).slice(0, limit)
  if (picked.length === limit) return picked
  const counts = new Map<string, { tag: string; n: number }>()
  for (const video of videos) {
    for (const raw of video.tags) {
      const tag = raw.trim()
      const key = tagKey(tag)
      if (!tag || tag.length > 28 || isGenericTag(tag) || isOrgTag(tag)) continue
      const entry = counts.get(key) ?? { tag, n: 0 }
      entry.n++
      counts.set(key, entry)
    }
  }
  for (const { tag } of [...counts.values()].sort((a, b) => b.n - a.n)) {
    if (picked.some((p) => tagKey(tag).startsWith(tagKey(p)))) continue
    picked.push(tag)
    if (picked.length === limit) break
  }
  return picked
}

export default function SearchPage() {
  const [params] = useSearchParams()
  const raw = params.get('q') ?? ''
  const q = raw.trim()
  // Phones: the Search tab lands with the caret in the field (not when coming Back to results).
  const popped = useNavigationType() === 'POP'
  useEffect(() => {
    if (raw || popped) return
    const field = document.getElementById('search-page-q')
    if (field?.offsetParent) field.focus()
  }, [raw, popped])
  // A submitted search (Enter in either field) moves focus to the results heading, so the next
  // arrow or Tab starts at the results and screen readers hear the new title.
  const location = useLocation()
  const submitted = (location.state as { submitted?: boolean } | null)?.submitted === true
  useEffect(() => {
    if (submitted && raw && !popped) document.getElementById(RESULTS_HEADING)?.focus()
  }, [location.key, submitted, raw, popped])
  const slug = params.get('category') ?? ''
  const category = slug ? getCategory(slug) : undefined

  const found = useMemo(() => (q ? searchCatalog(q, { limit: Infinity }) : NO_RESULTS), [q])
  // A likelier spelling ("nutrition" for "nutritoin"), offered when it finds clearly more.
  const fix = useMemo(() => {
    const text = found.correction
    if (!text || found.exact > FEW_RESULTS) return undefined
    const fixed = searchCatalog(text, { limit: Infinity })
    return clearlyMore(fixed.exact, found.exact) ? { text, videos: fixed.videos } : undefined
  }, [found])
  // Nothing as typed: the fix's results, under a note saying so.
  const showingFix = fix !== undefined && found.exact === 0
  const all = showingFix ? fix.videos : found.videos
  const searched = showingFix ? fix.text : q
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

  // Results come in pages of 24; a new query or filter starts over.
  const pageKey = `${q}\n${slug}`
  const [paging, setPaging] = useState<{ key: string; shown: number } | null>(null)
  const shown = paging?.key === pageKey ? paging.shown : (expanded.get(pageKey) ?? PAGE_SIZE)
  const visible = results.slice(0, shown)
  const grid = useRef<HTMLDivElement>(null)
  const focusAt = useRef(-1)

  // After "Load more", focus the first new card so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (focusAt.current < 0) return
    grid.current?.querySelectorAll<HTMLElement>('[data-card-link]')[focusAt.current]?.focus()
    focusAt.current = -1
  })

  const loadMore = () => {
    const next = Math.min(results.length, shown + PAGE_SIZE)
    expanded.set(pageKey, next)
    focusAt.current = shown
    setPaging({ key: pageKey, shown: next })
  }

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

  useSeo(searchSeo(q))

  // The header searches as you type, so a query is recorded once it rests; choosing a
  // collection filter or opening a result commits it at once.
  const { record } = useSearchHistory()
  useEffect(() => {
    if (!searched) return
    if (slug) {
      record(searched)
      return
    }
    const timer = window.setTimeout(() => record(searched), COMMIT_MS)
    return () => clearTimeout(timer)
  }, [searched, slug, record])

  // The biggest collections first; the rest (and never the active one) wait behind a toggle.
  const [allFacets, setAllFacets] = useState(false)
  const shownFacets =
    allFacets || facets.length <= FACETS_SHOWN + 1
      ? facets
      : facets.filter((f, i) => i < FACETS_SHOWN || f.name === category?.name)

  // Filter chips: one Tab stop, entered at the active filter.
  const activeFacet = category ? shownFacets.findIndex((f) => f.name === category.name) + 1 : 0
  const toggles = facets.length > FACETS_SHOWN + 1 ? 1 : 0
  const { listProps, tabIndexOf } = useRovingRow(shownFacets.length + 1 + toggles, activeFacet)

  // Phones: the filter row scrolls sideways, so bring the active chip into view.
  const row = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const ul = row.current
    const chip = ul?.querySelector<HTMLElement>('[aria-current]')
    if (!ul || !chip || ul.scrollWidth <= ul.clientWidth) return
    const left = chip.getBoundingClientRect().left - ul.getBoundingClientRect().left + ul.scrollLeft
    ul.scrollTo({ left: left - (ul.clientWidth - chip.offsetWidth) / 2 })
  }, [slug, q])

  // Arriving without a query from md up: the header field is the search field, so focus it.
  const landedEmpty = !q
  useEffect(() => {
    if (landedEmpty && window.matchMedia('(min-width: 48rem)').matches) focusSearch()
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const count = results.length
  const where = category ? ` in ${category.name}` : ''

  return (
    <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
      <SectionHeading
        as="h1"
        id={RESULTS_HEADING}
        tabIndex={-1}
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
      {/* Phones only: from md up the header field is always visible, so one field is enough. */}
      <SearchField query={raw} />

      {q ? (
        <>
          <p role="status" className="mt-5 text-sm text-ink-2">
            {showingFix
              ? `No videos match “${q}”. Showing results for “${fix.text}”.`
              : count === 0
                ? `No videos${where} match “${q}”`
                : `${count} ${count === 1 ? 'video' : 'videos'}${where}`}
          </p>
          {fix && (
            <p>
              <Link
                to={searchPath(fix.text)}
                state={SUBMITTED}
                className={`inline-flex min-h-10 items-center text-sm ${TEXT_LINK}`}
              >
                Did you mean “{fix.text}”?
              </Link>
            </p>
          )}
          {all.length > 0 && (
            <nav aria-label="Filter by collection" className="mt-2">
              <ul
                ref={row}
                role="list"
                data-spatial="group"
                {...listProps}
                className="-mx-(--gutter) flex gap-2 overflow-x-auto scroll-px-(--gutter) px-(--gutter) py-1 scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
              >
                <li>
                  <Chip
                    to={{ search: filterLink() }}
                    active={!category}
                    count={all.length}
                    tabIndex={tabIndexOf(0)}
                  >
                    All
                  </Chip>
                </li>
                {shownFacets.map((f, i) => (
                  <li key={f.name}>
                    <Chip
                      to={{ search: filterLink(f.slug) }}
                      active={category?.name === f.name}
                      count={f.n}
                      dot={MARK[toneOf(f.slug)]}
                      tabIndex={tabIndexOf(i + 1)}
                    >
                      {f.name}
                    </Chip>
                  </li>
                ))}
                {toggles > 0 && (
                  <li>
                    <button
                      type="button"
                      aria-expanded={allFacets}
                      tabIndex={tabIndexOf(shownFacets.length + 1)}
                      onClick={() => setAllFacets(!allFacets)}
                      className="inline-flex h-10 cursor-pointer items-center rounded-pill px-3.5 text-sm font-semibold whitespace-nowrap text-maroon transition-colors hover:bg-surface-2 hover:text-maroon-2"
                    >
                      {allFacets ? 'Fewer collections' : `All ${facets.length} collections`}
                    </button>
                  </li>
                )}
              </ul>
            </nav>
          )}
          {count > 0 ? (
            <>
              <div ref={grid} onClickCapture={() => record(searched)} className="mt-8">
                <GridHint />
                <DetailsContext value={target}>
                  <VideoGrid videos={visible} />
                </DetailsContext>
              </div>
              {count > PAGE_SIZE && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <p className="text-sm text-ink-3">
                    Showing {visible.length} of {count}
                  </p>
                  {visible.length < count && (
                    <Button variant="secondary" onClick={loadMore} data-spatial="wide">
                      Load {Math.min(PAGE_SIZE, count - visible.length)} more
                    </Button>
                  )}
                </div>
              )}
            </>
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

// The phone field, on its own so typing re-renders only it (with suggestions; a topic or a fix
// searches at once).
function SearchField({ query }: { query: string }) {
  const navigate = useNavigate()
  const field = useRef<HTMLInputElement>(null)
  const fieldSuggestions = useSearchSuggestions(
    field,
    (term) => navigate(searchPath(term), { state: SUBMITTED }),
    'inset-x-0',
  )

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    fieldSuggestions.close()
    const value = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    navigate(value ? searchPath(value) : '/search', { state: SUBMITTED })
  }

  return (
    <form role="search" onSubmit={submit} className="relative mt-5 flex max-w-2xl gap-2 md:hidden">
      <label htmlFor="search-page-q" className="sr-only">
        Search videos
      </label>
      <input
        ref={field}
        key={query}
        id="search-page-q"
        name="q"
        type="search"
        defaultValue={query}
        data-search-page=""
        placeholder="Title, topic or tag"
        autoComplete="off"
        {...fieldSuggestions.fieldProps}
        onChange={(e) => fieldSuggestions.onType(e.target.value)}
        onFocus={fieldSuggestions.onFocus}
        onKeyDown={fieldSuggestions.onKeyDown}
        onBlur={fieldSuggestions.onBlur}
        className="h-11 min-w-0 flex-1 rounded-pill border border-line bg-surface px-5 text-base text-ink placeholder:text-ink-3 focus:border-focus"
      />
      <Button type="submit" icon={<SearchIcon />}>
        Search
      </Button>
      {fieldSuggestions.list}
    </form>
  )
}

function Suggestions() {
  const topics = useMemo(() => popularTags(12), [])
  const series = useMemo(() => POPULAR_SERIES.filter(hasResults), [])
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
      {series.length > 0 && (
        <ChipGroup title="Series">
          {series.map((name) => (
            <li key={name}>
              <Chip to={`/search?q=${encodeURIComponent(name)}`} active={false} title={name}>
                {name}
              </Chip>
            </li>
          ))}
        </ChipGroup>
      )}
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
