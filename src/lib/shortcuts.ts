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

// A field holding text keeps it on Esc; anything else steps back.
const holdsText = (el: HTMLElement) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
    ? el.value !== ''
    : el.isContentEditable && el.textContent !== ''

export const topDialog = () => {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  return dialogs.length ? dialogs[dialogs.length - 1] : null
}
export const hasOpenDialog = () => topDialog() !== null

// requestClose fires `cancel` first (animated exits); older browsers close at once.
function closeDialog(dialog: HTMLDialogElement) {
  if (typeof dialog.requestClose === 'function') dialog.requestClose()
  else dialog.close()
}

/** Back = previous in-app page when there is one, otherwise home (deep links, replaced entries). */
export function useGoBack() {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => {
    // The browser router keeps the entry index in history.state (0 = first page of this visit,
    // also after a replace); without it (memory router in tests) fall back to the location key.
    const idx = (window.history.state as { idx?: number } | null)?.idx
    const hasPrevious = idx === undefined ? key !== 'default' : idx > 0
    if (hasPrevious) void navigate(-1)
    else void navigate('/', { replace: true })
  }, [key, navigate])
}

/**
 * App-wide keys, mounted once in AppLayout:
 * Esc and Backspace = Back (an open <dialog> closes instead; a text field with content is only
 * blurred and keeps its text, an empty one steps back; Backspace still types in fields),
 * `/` = focus search, `?` = shortcuts sheet. Events with defaultPrevented are ignored, so a
 * component that handles a key itself just calls preventDefault.
 */
export function useGlobalShortcuts() {
  const goBack = useGoBack()
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
    const editing = isEditable(e.target)
    if (e.key === 'Escape' || (e.key === 'Backspace' && !editing)) {
      const dialog = topDialog()
      if (dialog) {
        // Esc closes it natively; Backspace asks for the same.
        if (e.key === 'Backspace') {
          e.preventDefault()
          closeDialog(dialog)
        }
        return
      }
      if (editing) {
        const field = e.target as HTMLElement
        field.blur()
        if (holdsText(field)) return
      }
      e.preventDefault()
      goBack()
    } else if (!editing && e.key === '/') {
      e.preventDefault()
      focusSearch()
    } else if (!editing && e.key === '?') {
      // Never stack the sheet on top of another dialog.
      if (hasOpenDialog()) return
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
