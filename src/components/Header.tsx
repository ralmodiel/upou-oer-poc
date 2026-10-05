import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { Link, NavLink, useLocation, useMatch, useNavigate, useNavigationType } from 'react-router'
import { getVideo } from '../data/catalog'
import { useHelp } from '../lib/howitworks'
import { openPrivacy } from '../lib/privacy'
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
  ShieldIcon,
} from './icons'
import { useSearchSuggestions } from './SearchSuggest'
import ThemeToggle from './ThemeToggle'
import Menu, { type MenuSection } from './ui/Menu'
import { buttonClass, iconButtonClass } from './ui/button-styles'

// Active section: a maroon underline on paper (gold in dark mode) with a soft glow. Hover: a glass
// pill, as the chips and breadcrumbs.
// Touch: the underline is its ::after (the global 44px hit area skips it), so the area is its ::before.
const NAV_LINK =
  'relative inline-flex h-10 items-center pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-0.5 rounded-pill px-2 text-sm font-medium whitespace-nowrap text-ink-2 transition-[background-color,color,box-shadow] hover:bg-frost-2 hover:text-ink hover:shadow-(--shadow-glass) focus-visible:shadow-glow aria-[current=page]:font-semibold aria-[current=page]:text-ink after:absolute after:inset-x-2 after:-bottom-1.5 after:h-[3px] after:rounded-full after:bg-maroon after:opacity-0 after:shadow-[0_0_10px_1px_var(--color-glow-brand)] after:transition-opacity aria-[current=page]:after:opacity-100 dark:after:bg-band-gold lg:px-3 lg:after:inset-x-3'

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
      className={`inline-grid h-5 min-w-5 place-items-center rounded-pill bg-action bg-(image:--gradient-action) px-1.5 text-xs leading-none font-bold text-on-action tabular-nums dark:bg-band-gold dark:bg-none dark:text-charcoal ${className}`}
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
      // The UP tri-colour stripe runs along the top edge (inside the header's height).
      // Glass: translucent paper over a modest blur, so content scrolls softly beneath it. Once
      // scrolled, a faint brand edge glows along its foot (index.css, shell-edge).
      data-scrolled={scrolled || undefined}
      className={`shell-edge sticky top-0 z-40 border-b bg-glass backdrop-blur-lg backdrop-saturate-150 transition-[border-color,box-shadow] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:brand-stripe ${
        scrolled ? 'border-glass-border shadow-(--shadow-elev-2)' : 'border-line'
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
              className="rounded-pill border border-glass-border bg-frost px-1 py-1 text-xs shadow-[inset_0_1px_0_var(--color-rim)] leading-none font-semibold tracking-wide text-ink-2 uppercase sm:px-1.5 sm:tracking-wider"
            >
              Proof of concept
            </span>
          </div>
          <p className="-mt-1.5 hidden text-xs leading-none tracking-wide text-ink-3 md:block">
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
        {/* One stop: a flip button on phones and desktop (tablets use the Help menu); light, dark
            and system are all in the Help menu. */}
        <ThemeToggle className="ml-auto md:hidden lg:ml-0 lg:inline-flex" />
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

// Help, shortcuts and the theme choice (light, dark, system) without scrolling to the footer.
// Keyboard shortcuts are listed only where there is a keyboard to speak of (mouse / trackpad).
function HelpMenu() {
  const wide = useMediaQuery('(min-width: 64rem)')
  const touchOnly = useMediaQuery('(hover: none)')
  const { theme, setTheme } = useTheme()
  const help = useHelp()

  const sections: MenuSection[] = [
    {
      items: [
        { label: 'How it works', icon: <HelpIcon />, onSelect: help },
        { label: 'Privacy and history', icon: <ShieldIcon />, onSelect: openPrivacy },
        ...(touchOnly
          ? []
          : [
              {
                label: 'Keyboard shortcuts',
                icon: <KeyboardIcon />,
                onSelect: openShortcuts,
                hint: '?',
              },
            ]),
      ],
    },
  ]
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

  // Wide screens show the word, so help is discoverable; phones keep the icon. While open the
  // trigger stays glass, so the menu reads as coming from it.
  const held =
    'aria-expanded:bg-frost-2 aria-expanded:text-ink aria-expanded:shadow-(--shadow-glass)'
  return (
    <Menu
      label="Help and theme"
      sections={sections}
      triggerClassName={
        wide ? buttonClass('ghost', 'sm', held) : iconButtonClass('ghost', 'sm', held)
      }
    >
      <HelpIcon />
      {wide && 'Help'}
    </Menu>
  )
}

const FROM_SEARCH_BOX = { fromSearchBox: true }
// A submitted search (Enter): the search page moves focus to its results heading.
const SUBMITTED = { fromSearchBox: true, submitted: true }

function SearchBox() {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationType = useNavigationType()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)

  // Matches "/search/" too: a direct load of the static shell lands there.
  const onSearchPage = useMatch('/search') !== null
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

  const go = (term: string, submitted = false) => {
    setPending(null)
    if (!term && !onSearchPage) return
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search', {
      replace: onSearchPage,
      state: submitted ? SUBMITTED : FROM_SEARCH_BOX,
    })
  }

  // Search 250ms after the last keystroke.
  const search = useEffectEvent(go)
  useEffect(() => {
    if (pending === null) return
    const timer = window.setTimeout(() => search(pending), 250)
    return () => clearTimeout(timer)
  }, [pending])

  // Suggestions while typing; a topic or a fix is searched as if submitted.
  const suggestions = useSearchSuggestions(
    input,
    (term) => {
      setValue(term)
      go(term, true)
    },
    'inset-x-0 md:left-auto md:w-[max(100%,26rem)]',
  )

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
      // Already visible (md and up): focus now, before any keystroke can land. The sticky header is
      // on screen, so the page stays where it is.
      field.focus({ preventScroll: true })
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
    input.current?.focus({ preventScroll: true })
    input.current?.select()
  }, [focusTick])

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setValue(next)
    setPending(next.trim())
    suggestions.onType(next)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    suggestions.close()
    go(value.trim(), true)
    input.current?.blur()
  }

  const clear = () => {
    setValue('')
    suggestions.close()
    go('')
    input.current?.focus({ preventScroll: true })
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={`${expanded ? 'flex' : 'hidden md:flex'} order-last min-w-0 basis-full pb-2.5 md:order-none md:ml-auto md:w-40 md:basis-auto md:max-lg:land:w-48 md:pb-0 lg:w-56 xl:w-80`}
    >
      <label htmlFor={inputId} className="sr-only">
        Search videos
      </label>
      <div className="group/search relative w-full">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3 transition-colors group-focus-within/search:text-ink-2" />
        <input
          ref={input}
          id={inputId}
          type="search"
          value={value}
          {...suggestions.fieldProps}
          onChange={onChange}
          onFocus={suggestions.onFocus}
          onKeyDown={(e) => {
            // An open list takes ↑ / ↓, Enter and the first Esc.
            suggestions.onKeyDown(e)
            if (e.defaultPrevented || e.key !== 'Escape') return
            // With a query: leave the field but keep the query and its results. Empty: the
            // app-wide Esc = Back takes over.
            if (value) {
              e.preventDefault()
              e.currentTarget.blur()
            } else setOpen(false)
          }}
          onBlur={() => {
            suggestions.onBlur()
            if (!value.trim()) setOpen(false)
          }}
          placeholder="Search videos"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          // Glass, as the other chrome controls: a light rim, a hairline and a soft drop on hover
          // and focus; focus adds the focus-colour border and the TV glow.
          className="h-10 w-full rounded-pill border border-glass-border bg-surface/90 pr-10 pl-10 text-sm text-ink shadow-(--shadow-elev-1) transition-[background-color,border-color,box-shadow] placeholder:text-ink-3 hover:border-rim hover:bg-surface hover:shadow-(--shadow-glass) focus:border-focus focus:bg-surface focus:shadow-(--shadow-glass) focus-visible:shadow-[var(--shadow-glass),var(--shadow-glow)] [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clear}
            className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-pill text-ink-3 transition-[background-color,color,box-shadow] hover:bg-frost-2 hover:text-ink hover:shadow-(--shadow-glass) focus-visible:bg-frost-2 focus-visible:text-ink focus-visible:shadow-[var(--shadow-glass),var(--shadow-glow)]"
          >
            <CloseIcon className="size-4" />
          </button>
        )}
        {suggestions.list}
      </div>
    </form>
  )
}

// Active tab: maroon label and a glowing top bar on paper, gold in dark mode; its icon sits on a
// small glass disc. The focus ring sits inside the bar (it is flush with the screen edge).
const TAB =
  'group/tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink focus-visible:-outline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:text-maroon after:absolute after:inset-x-6 after:top-0 after:h-[3px] after:rounded-b-full after:bg-maroon after:opacity-0 after:shadow-[0_0_12px_2px_var(--color-glow-brand)] after:transition-opacity aria-[current=page]:after:opacity-100 dark:aria-[current=page]:text-band-gold dark:after:bg-band-gold'
// The icon's box (24px, as the icon alone); the disc is a ::before 4px wider all round, so nothing
// moves. Warm grey on paper (white frost would vanish on the white bar), frost in dark.
const TAB_ICON =
  'relative isolate grid place-items-center before:absolute before:-inset-1 before:-z-10 before:rounded-full before:bg-surface-2 before:opacity-0 before:shadow-(--shadow-glass) before:transition-opacity group-aria-[current=page]/tab:before:opacity-100 dark:before:bg-frost-2'

/** Phone navigation (< md): Browse · Collections · Search · My List, pinned to the bottom. */
export function TabBar() {
  const saved = useSavedCount()
  return (
    <nav
      aria-label="Primary"
      // Glass like the header; surface at 92% so the ink-3 labels keep AA over a black picture.
      // A faint lift on paper, a deeper one in dark.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-surface/92 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-8px_24px_-18px_rgb(27_26_23/0.18)] dark:shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.6)] backdrop-blur-lg backdrop-saturate-150 md:hidden"
    >
      <ul className="flex h-(--tabbar-h)">
        <li className="flex flex-1">
          <NavLink to="/" end className={TAB}>
            <span className={TAB_ICON}>
              <HomeIcon className="size-6" />
            </span>
            Browse
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/collections" className={TAB}>
            <span className={TAB_ICON}>
              <GridIcon className="size-6" />
            </span>
            Collections
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/search" className={TAB}>
            <span className={TAB_ICON}>
              <SearchIcon className="size-6" />
            </span>
            Search
          </NavLink>
        </li>
        <li className="flex flex-1">
          <NavLink to="/my-list" aria-label={myListLabel(saved)} className={TAB}>
            <span className={TAB_ICON}>
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
