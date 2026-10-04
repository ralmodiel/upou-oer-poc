// Suggestions under a search field, as an ARIA combobox: after a short pause in typing, a list of
// up to six items (the fix for a misspelt query, collections, topics, titles). ↑ / ↓ move through
// the open list (an expanded combobox owns them, so remote navigation stays out), Enter opens the
// highlighted item, Esc closes the list before it means anything else, and a press or tap opens
// an item. Focus never leaves the field.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router'
import { useSearchHistory } from '../lib/history'
import { suggest, warmSuggestions, type Suggestion, type SuggestionKind } from '../lib/suggest'
import { onIdle } from './browse-hooks'

// Suggestions follow the typing after this pause.
const PAUSE_MS = 100
// A single letter says too little to suggest from.
const MIN_LENGTH = 2

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
 * search history, when allowed); a topic or a fix goes to `search`. `className` places the list.
 */
export function useSearchSuggestions(
  field: RefObject<HTMLInputElement | null>,
  search: (query: string) => void,
  className = '',
): SearchSuggestions {
  const navigate = useNavigate()
  const { record } = useSearchHistory()
  const listId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Text waiting for the pause; null when nothing is pending.
  const [pending, setPending] = useState<string | null>(null)
  const typed = useRef('')

  useEffect(() => {
    if (pending === null) return
    const timer = window.setTimeout(() => {
      const next = suggest(pending)
      setPending(null)
      setItems(next)
      setActive(-1)
      // Only into a field that still has focus.
      setOpen(next.length > 0 && document.activeElement === field.current)
    }, PAUSE_MS)
    return () => clearTimeout(timer)
  }, [pending, field])

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

  const close = () => {
    setPending(null)
    setOpen(false)
    setActive(-1)
  }

  const onType = (text: string) => {
    typed.current = text.trim()
    if (typed.current.length < MIN_LENGTH) close()
    else setPending(typed.current)
  }

  const choose = (item: Suggestion) => {
    close()
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
      className={`absolute top-full z-50 mt-1.5 max-h-[min(23rem,calc(100dvh-var(--header-h)-4.5rem))] overflow-y-auto overscroll-contain rounded-card border border-line bg-surface p-1.5 text-sm shadow-lift ${className}`}
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
          className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-ink aria-selected:bg-surface-2 aria-selected:outline-2 aria-selected:-outline-offset-2 aria-selected:outline-focus"
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
    // The index and vocabulary are built while the browser is idle, before the first keystroke.
    onFocus: () => void onIdle(warmSuggestions),
    onBlur: close,
    close,
    list,
  }
}
