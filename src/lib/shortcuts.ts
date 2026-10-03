import { useCallback, useEffect, useEffectEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'

// Window events keep the shell, the header search and pages decoupled.
export const FOCUS_SEARCH_EVENT = 'upou:focus-search'
export const OPEN_SHORTCUTS_EVENT = 'upou:open-shortcuts'

/** Expands (on phones) and focuses the header search field. */
export const focusSearch = () => window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT))
/** Opens the keyboard shortcuts sheet. */
export const openShortcuts = () => window.dispatchEvent(new Event(OPEN_SHORTCUTS_EVENT))

/** Runs `handler` for one of the app events above while mounted. */
export function useAppEvent(name: string, handler: () => void) {
  const onEvent = useEffectEvent(handler)
  useEffect(() => {
    const listener = () => onEvent()
    window.addEventListener(name, listener)
    return () => window.removeEventListener(name, listener)
  }, [name])
}

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'range',
  'color',
  'file',
])

/** True when typing would go into `target` (text inputs, textareas, selects, contenteditable). */
export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}

export const hasOpenDialog = () => document.querySelector('dialog[open]') !== null

/** Back = previous in-app page when there is one, otherwise home (deep links). */
export function useGoBack() {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => {
    if (key !== 'default') void navigate(-1)
    else void navigate('/', { replace: true })
  }, [key, navigate])
}

/**
 * App-wide keys, mounted once in AppLayout:
 * Esc = Back (an open <dialog> closes itself instead; a focused text field is only blurred),
 * `/` = focus search, `?` = shortcuts sheet. Events with defaultPrevented are ignored, so a
 * component that handles a key itself just calls preventDefault.
 */
export function useGlobalShortcuts() {
  const goBack = useGoBack()
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
    const editing = isEditable(e.target)
    if (e.key === 'Escape') {
      if (hasOpenDialog()) return
      if (editing) {
        ;(e.target as HTMLElement).blur()
        return
      }
      e.preventDefault()
      goBack()
    } else if (!editing && e.key === '/') {
      e.preventDefault()
      focusSearch()
    } else if (!editing && e.key === '?') {
      e.preventDefault()
      openShortcuts()
    }
  })

  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKeyDown(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
