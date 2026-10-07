// Suggestions under a search field, as an ARIA combobox: after a short pause in typing, a list of
// up to six items (the fix for a misspelt query, collections, topics, titles). ↑ / ↓ move through
// the open list (an expanded combobox owns them, so remote navigation stays out), Enter opens the
// highlighted item, Esc closes the list before it means anything else, and a press or tap opens
// an item. Focus never leaves the field.
import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router'
import { catalogComplete, isCatalogComplete } from '../data/catalog'
import { useSearchHistory } from '../lib/history'
import { prefersReducedMotion } from './hooks'
import {
  suggestionsWarmup,
  suggestSteps,
  type Suggestion,
  type SuggestionKind,
} from '../lib/suggest'
import './pages.css'

// Suggestions follow the typing after this pause.
const PAUSE_MS = 100
// A single letter says too little to suggest from.
const MIN_LENGTH = 2
// Longest stretch of warm-up or suggestion work at a time, so a key never waits long behind it.
const SLICE_MS = 4

/** Runs `steps` in slices of about SLICE_MS, letting the browser in between; then `done`. */
function runSliced<T>(steps: Iterator<void, T>, done: (value: T) => void) {
  const slice = () => {
    const end = performance.now() + SLICE_MS
    for (;;) {
      const step = steps.next()
      if (step.done) return done(step.value)
      if (performance.now() > end) return void window.setTimeout(slice)
    }
  }
  slice()
}

// Callbacks waiting for the warm-up (search index, vocabulary, topics), which runs in short slices.
let waiting: (() => void)[] = []

/** Runs `fn` once what suggestions use is built: at once when it is, else after the slices. */
function whenWarm(fn: () => void) {
  waiting.push(fn)
  if (waiting.length > 1) return
  const warm = () =>
    runSliced(suggestionsWarmup(), () => {
      const ready = waiting
      waiting = []
      for (const f of ready) f()
    })
  // The suggestions read every video: on a first visit they wait for the rest of the catalog.
  if (isCatalogComplete()) warm()
  else void catalogComplete().then(warm)
}

const KIND_LABEL: Record<SuggestionKind, string> = {
  search: 'Search',
  collection: 'Collection',
  topic: 'Topic',
  video: 'Video',
}

export interface SearchSuggestions {
  /** Combobox attributes for the field. */
  fieldProps: {
    role: 'combobox'
    'aria-autocomplete': 'list'
    'aria-expanded': boolean
    'aria-controls': string
    'aria-activedescendant': string | undefined
  }
  /** Call with the field's text on every change. */
  onType: (text: string) => void
  /** Call first from the field's onKeyDown: a key it handles is defaultPrevented. */
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  onBlur: () => void
  close: () => void
  /** The list: render it after the field, inside a positioned box. */
  list: ReactNode
}

/**
 * Suggestions for `field`. A video or collection opens its page (committing the typed query to
 * search history, when allowed); a topic or a fix goes to `search`. `className` places the list;
 * `onPick` runs before any pick (the header drops its pending as-you-type search).
 */
export function useSearchSuggestions(
  field: RefObject<HTMLInputElement | null>,
  search: (query: string) => void,
  className = '',
  onPick?: () => void,
): SearchSuggestions {
  const navigate = useNavigate()
  const { record } = useSearchHistory()
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Typing changes no state: the text and the pause live in refs, and each keystroke or close
  // bumps `turn`, so an older pause or warm-up never opens the list.
  const typed = useRef('')
  const timer = useRef(0)
  const turn = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Keep the highlighted item in view inside the list, never by scrolling the page.
  useEffect(() => {
    const list = listRef.current
    const item = active >= 0 ? (list?.children[active] as HTMLElement | undefined) : undefined
    if (!list || !item) return
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight
    }
  }, [active])

  const shown = open && items.length > 0

  // A list opening past the foot of the screen, under a field low on a short one (the search page
  // on a phone on its side), brings the field up to the top so the list shows.
  useEffect(() => {
    const list = listRef.current
    if (!shown || !list || list.getBoundingClientRect().bottom <= innerHeight) return
    field.current?.scrollIntoView({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [shown, field])

  const close = () => {
    turn.current++
    clearTimeout(timer.current)
    setOpen(false)
    setActive(-1)
  }

  const onType = (text: string) => {
    const query = text.trim()
    typed.current = query
    if (query.length < MIN_LENGTH) return close()
    const at = ++turn.current
    clearTimeout(timer.current)
    timer.current = window.setTimeout(
      () =>
        whenWarm(() => {
          if (turn.current !== at) return
          runSliced(suggestSteps(query), (next) => {
            if (turn.current !== at) return
            // Only into a field that still has focus; the list renders without holding up keys.
            const into = next.length > 0 && document.activeElement === field.current
            startTransition(() => {
              setItems(next)
              setActive(-1)
              setOpen(into)
            })
          })
        }),
      PAUSE_MS,
    )
  }

  const choose = (item: Suggestion) => {
    close()
    onPick?.()
    if (item.kind === 'video' || item.kind === 'collection') {
      // Opening a result commits the query, as on the search page.
      record(typed.current)
      void navigate(item.to)
    } else search(item.label)
    field.current?.blur()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shown || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return
    const last = items.length - 1
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      // Past either end: back to the text as typed, nothing highlighted.
      if (e.key === 'ArrowDown') setActive(active < last ? active + 1 : -1)
      else setActive(active < 0 ? last : active - 1)
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Escape') {
      // The list closes first; the next Esc is the field's own (or Back).
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') close()
  }

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label="Suggestions"
      hidden={!shown}
      className={`absolute top-full z-50 mt-1.5 max-h-[min(23rem,calc(100dvh-var(--header-h)-4.5rem))] overflow-y-auto overscroll-contain shell-scroll tv-suggest rounded-card border border-glass-border bg-surface p-1.5 text-sm shadow-(--shadow-elev-3) ${className}`}
    >
      {items.map((item, i) => (
        <li
          key={`${item.kind} ${item.to}`}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          // Focus stays in the field, so the list is still there for the click.
          onMouseDown={(e) => e.preventDefault()}
          onMouseMove={() => setActive(i)}
          onClick={() => choose(item)}
          className="flex min-h-10 pointer-coarse:min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-ink aria-selected:bg-surface-2 aria-selected:outline-2 aria-selected:-outline-offset-2 aria-selected:outline-focus"
        >
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="eyebrow shrink-0 text-ink-3">{KIND_LABEL[item.kind]}</span>
        </li>
      ))}
    </ul>
  )

  return {
    fieldProps: {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': shown,
      'aria-controls': listId,
      'aria-activedescendant': shown && active >= 0 ? `${listId}-${active}` : undefined,
    },
    onType,
    onKeyDown,
    // The index, vocabulary and topics are built in short slices from here, before the first key.
    onFocus: () => whenWarm(() => {}),
    onBlur: close,
    close,
    list,
  }
}
