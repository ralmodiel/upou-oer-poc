import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, NavLink, useLocation, useNavigate, useNavigationType } from 'react-router'
import { getVideo } from '../data/catalog'
import { useMyList } from '../lib/storage'
import { useScrolledPast } from './hooks'
import { CloseIcon, SearchIcon } from './icons'

const NAV_LINK =
  'relative py-1 text-neutral-300 transition-colors duration-200 hover:text-white aria-[current=page]:font-semibold aria-[current=page]:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-brand-500 after:transition-transform after:duration-300 after:ease-cinematic aria-[current=page]:after:scale-x-100'

export default function Header() {
  const scrolled = useScrolledPast(40)
  const { ids } = useMyList()
  const saved = ids.filter((id) => getVideo(id)).length

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-ink-950/90 via-ink-950/50 to-transparent"
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-ink-950/95 shadow-lg shadow-black/40 backdrop-blur-md transition-opacity duration-300 ease-cinematic ${scrolled ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="relative flex min-h-14 flex-wrap items-center gap-x-3 px-(--gutter) sm:min-h-16 sm:gap-x-8">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className="py-3 text-base leading-none font-black tracking-tighter uppercase sm:text-2xl"
          >
            <span className="text-brand-500">UPOU</span>{' '}
            <span className="text-white">Networks</span>
          </Link>
          <span
            role="note"
            title="Proof of concept"
            aria-label="Proof of concept"
            className="rounded-full px-1 py-0.5 text-[10px] leading-none font-semibold tracking-wider text-neutral-300 uppercase ring-1 ring-white/30"
          >
            PoC
          </span>
        </div>
        <nav aria-label="Main" className="flex items-center gap-3 text-sm sm:gap-6">
          <NavLink to="/" end className={NAV_LINK}>
            Home
          </NavLink>
          <NavLink to="/my-list" className={NAV_LINK}>
            My List
            {saved > 0 && (
              <span className="absolute -top-2 -right-3.5 inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-brand-600 px-1 align-[0.1em] text-[0.6875rem] leading-none font-bold text-white tabular-nums sm:static sm:ml-1.5">
                {saved}
                <span className="sr-only"> saved</span>
              </span>
            )}
          </NavLink>
        </nav>
        <SearchBox />
      </div>
    </header>
  )
}

const FROM_SEARCH_BOX = { fromSearchBox: true }

function SearchBox() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  const onSearchPage = location.pathname === '/search'
  const query = onSearchPage ? (new URLSearchParams(location.search).get('q') ?? '') : ''
  const [value, setValue] = useState(query)
  const [open, setOpen] = useState(false)
  // Term waiting for the debounce; null when nothing is pending.
  const [pending, setPending] = useState<string | null>(null)
  const [seenKey, setSeenKey] = useState(location.key)

  // Follow URL changes that didn't come from typing here (links, back/forward, leaving search).
  if (seenKey !== location.key) {
    setSeenKey(location.key)
    const typedHere =
      navigationType !== 'POP' &&
      (location.state as { fromSearchBox?: boolean } | null)?.fromSearchBox
    if (!typedHere) {
      // Drop a pending search so it can't pull the user back after they navigated away.
      setPending(null)
      setValue(query)
      if (!query) setOpen(false)
    }
  }

  const expanded = open || onSearchPage || value !== ''

  const go = (term: string) => {
    setPending(null)
    if (!term && !onSearchPage) return
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search', {
      replace: onSearchPage,
      state: FROM_SEARCH_BOX,
    })
  }

  // Search 250ms after the last keystroke.
  const search = useEffectEvent(go)
  useEffect(() => {
    if (pending === null) return
    const timer = window.setTimeout(() => search(pending), 250)
    return () => clearTimeout(timer)
  }, [pending])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    setPending(next.trim())
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    go(value.trim())
    input.current?.blur()
  }

  const clear = () => {
    setValue('')
    go('')
    input.current?.focus()
  }

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setOpen(true)}
        className="-mr-2 ml-auto grid size-10 place-items-center rounded-full text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
      >
        <SearchIcon className="size-5" />
      </button>
    )
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="relative order-last basis-full pb-3 transition duration-300 ease-cinematic starting:-translate-y-1 starting:opacity-0 sm:order-none sm:ml-auto sm:w-64 sm:basis-auto sm:origin-right sm:pb-0 sm:starting:translate-y-0 sm:starting:scale-x-90 lg:w-72"
    >
      <label htmlFor={inputId} className="sr-only">
        Search videos
      </label>
      <SearchIcon className="pointer-events-none absolute top-5 left-3 z-10 size-4 -translate-y-1/2 text-neutral-400 sm:top-1/2" />
      <input
        ref={input}
        id={inputId}
        type="search"
        value={value}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          if (value) clear()
          else {
            setOpen(false)
            e.currentTarget.blur()
          }
        }}
        onBlur={() => {
          if (!value.trim()) setOpen(false)
        }}
        autoFocus={open}
        placeholder="Titles, topics, tags"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-10 w-full rounded-md border border-white/20 bg-ink-950/80 pr-10 pl-9 text-sm text-white backdrop-blur-sm transition-colors placeholder:text-neutral-400 focus:border-white/50 focus-visible:outline-offset-0 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={clear}
          className="absolute top-5 right-1 z-10 grid size-8 -translate-y-1/2 place-items-center rounded text-neutral-400 hover:text-white sm:top-1/2"
        >
          <CloseIcon className="size-4" />
        </button>
      )}
    </form>
  )
}
