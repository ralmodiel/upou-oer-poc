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
import { useHelp } from '../lib/howitworks'
import { FOCUS_SEARCH_EVENT, openShortcuts, useAppEvent } from '../lib/shortcuts'
import { useMyList } from '../lib/storage'
import { THEMES, useTheme, type Theme } from '../lib/theme'
import { useMediaQuery, useScrolledPast } from './hooks'
import {
  BookmarkIcon,
  CloseIcon,
  GridIcon,
  HelpIcon,
  HomeIcon,
  KeyboardIcon,
  MonitorIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from './icons'
import ThemeToggle from './ThemeToggle'
import Menu, { type MenuSection } from './ui/Menu'
import { iconButtonClass } from './ui/button-styles'

const NAV_LINK =
  'relative inline-flex h-10 items-center rounded-pill px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink aria-[current=page]:font-semibold aria-[current=page]:text-ink after:absolute after:inset-x-2 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-maroon after:opacity-0 after:transition-opacity aria-[current=page]:after:opacity-100 lg:px-3 lg:after:inset-x-3'

// Saved ids that still exist in the catalog.
function useSavedCount() {
  const { ids } = useMyList()
  return ids.filter((id) => getVideo(id)).length
}

// Decorative: the link carries the count in its name.
function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid h-5 min-w-5 place-items-center rounded-pill bg-maroon px-1.5 text-[0.6875rem] leading-none font-bold text-on-accent tabular-nums ${className}`}
    >
      {count}
    </span>
  )
}

const myListLabel = (saved: number) => (saved > 0 ? `My List, ${saved} saved` : undefined)

export default function Header() {
  const scrolled = useScrolledPast(8)
  const saved = useSavedCount()

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line transition-[background-color,box-shadow] ${
        scrolled
          ? 'bg-paper/85 shadow-[0_10px_24px_-20px_rgb(27_26_23/0.45)] backdrop-blur-md'
          : 'bg-paper'
      }`}
    >
      <div className="flex min-h-(--header-h) flex-wrap items-center gap-x-2 px-(--gutter) md:flex-nowrap lg:gap-x-3">
        {/* Brand lock-up: wordmark + pill, with the descriptor underneath from md. */}
        <div className="flex min-w-0 shrink-0 flex-col">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="UPOU OER, home"
              className="flex min-h-10 items-center gap-1 rounded-sm font-display text-[1.375rem] leading-none tracking-tight sm:text-2xl"
            >
              <span className="text-ink">UPOU</span>
              <span className="text-maroon">OER</span>
            </Link>
            <span
              role="note"
              title="Proof of concept"
              aria-label="Proof of concept"
              className="rounded-pill border border-line bg-surface px-1.5 py-1 text-[0.625rem] leading-none font-semibold tracking-wider text-ink-2 uppercase"
            >
              Proof of concept
            </span>
          </div>
          <p className="-mt-1.5 hidden text-[0.6875rem] leading-none tracking-wide text-ink-3 md:block">
            Open Educational Resources
          </p>
        </div>
        <nav aria-label="Main" className="ml-3 hidden items-center gap-0.5 md:flex lg:ml-6">
          <NavLink to="/" end className={NAV_LINK}>
            Browse
          </NavLink>
          <NavLink to="/collections" className={NAV_LINK}>
            Collections
          </NavLink>
          <NavLink to="/my-list" aria-label={myListLabel(saved)} className={NAV_LINK}>
            My List
            {saved > 0 && <CountBadge count={saved} className="ml-1.5" />}
          </NavLink>
        </nav>
        <SearchBox />
        {/* Phones: one tap flips light/dark. Tablets: theme lives in the Help menu. Desktop: all three. */}
        <ThemeToggle compact className="ml-auto md:hidden" />
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
        <HelpMenu />
      </div>
    </header>
  )
}

const THEME_ICONS: Record<Theme, typeof SunIcon> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
}

// Help and shortcuts without scrolling to the footer; below lg it also holds the theme choice.
function HelpMenu() {
  const wide = useMediaQuery('(min-width: 64rem)')
  const { theme, setTheme } = useTheme()
  const help = useHelp()

  const sections: MenuSection[] = [
    {
      items: [
        { label: 'How it works', icon: <HelpIcon />, onSelect: help },
        { label: 'Keyboard shortcuts', icon: <KeyboardIcon />, onSelect: openShortcuts, hint: '?' },
      ],
    },
  ]
  if (!wide) {
    sections.push({
      title: 'Theme',
      items: THEMES.map(({ value, label }) => {
        const Icon = THEME_ICONS[value]
        return {
          label,
          icon: <Icon />,
          checked: theme === value,
          onSelect: () => setTheme(value),
        }
      }),
    })
  }

  return (
    <Menu
      label={wide ? 'Help' : 'Help and theme'}
      sections={sections}
      triggerClassName={iconButtonClass('ghost', 'sm')}
    >
      <HelpIcon />
    </Menu>
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
  // Bumped by anything that wants the field focused; the effect runs once the field is visible.
  const [focusTick, setFocusTick] = useState(0)

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

  // On phones the field is a second header row that opens on demand (`/`; the Search tab and the
  // search page have their own); from md up it is always shown.
  const expanded = open || (value !== '' && !onSearchPage)

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

  const requestFocus = () => {
    // The search page's own field (phones) takes over while it is the visible one.
    const pageField = document.querySelector<HTMLInputElement>('input[data-search-page]')
    if (pageField?.offsetParent) {
      pageField.focus()
      pageField.select()
      return
    }
    const field = input.current
    if (field?.offsetParent) {
      // Already visible (md and up): focus now, before any keystroke can land.
      field.focus()
      field.select()
      return
    }
    // The phone field renders first; the tick focuses it once it is visible.
    setOpen(true)
    setFocusTick((t) => t + 1)
  }
  useAppEvent(FOCUS_SEARCH_EVENT, requestFocus)
  useEffect(() => {
    if (!focusTick) return
    input.current?.focus()
    input.current?.select()
  }, [focusTick])

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

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={`${expanded ? 'flex' : 'hidden md:flex'} order-last min-w-0 basis-full pb-2.5 md:order-none md:ml-auto md:w-40 md:basis-auto md:pb-0 lg:w-56 xl:w-80`}
    >
      <label htmlFor={inputId} className="sr-only">
        Search videos
      </label>
      <div className="relative w-full">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
        <input
          ref={input}
          id={inputId}
          type="search"
          value={value}
          onChange={onChange}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            // With a query: leave the field but keep the query and its results. Empty: the
            // app-wide Esc = Back takes over.
            if (value) {
              e.preventDefault()
              e.currentTarget.blur()
            } else setOpen(false)
          }}
          onBlur={() => {
            if (!value.trim()) setOpen(false)
          }}
          placeholder="Search videos"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-10 w-full rounded-pill border border-line bg-surface pr-10 pl-10 text-sm text-ink transition-colors placeholder:text-ink-3 hover:border-ink-3 focus:border-maroon [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-pill text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
      </div>
    </form>
  )
}

const TAB =
  'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-ink-3 transition-colors hover:text-ink aria-[current=page]:text-maroon after:absolute after:inset-x-6 after:top-0 after:h-0.5 after:rounded-b-full after:bg-maroon after:opacity-0 after:transition-opacity aria-[current=page]:after:opacity-100'

/** Phone navigation (< md): Browse · Collections · Search · My List, pinned to the bottom. */
export function TabBar() {
  const saved = useSavedCount()
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="flex h-(--tabbar-h)">
        <li className="flex flex-1">
          <NavLink to="/" end className={TAB}>
            <HomeIcon className="size-6" />
            Browse
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/collections" className={TAB}>
            <GridIcon className="size-6" />
            Collections
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/search" className={TAB}>
            <SearchIcon className="size-6" />
            Search
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/my-list" aria-label={myListLabel(saved)} className={TAB}>
            <span className="relative">
              <BookmarkIcon className="size-6" />
              {saved > 0 && <CountBadge count={saved} className="absolute -top-1.5 -right-3" />}
            </span>
            My List
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
