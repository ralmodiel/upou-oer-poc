// PrivacyDialog: native modal <dialog> with the viewer's history and personalization switches.
// Opens on OPEN_PRIVACY_EVENT (`openPrivacy()` from the Help menu, the footer or a row's link).
// Everything it controls lives in this browser's localStorage. Mount once in AppLayout.
import { useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { useSearchHistory } from '../lib/history'
import { OPEN_PRIVACY_EVENT, pickSources } from '../lib/privacy'
import { useAppEvent } from '../lib/shortcuts'
import { candidates } from '../lib/spatial'
import { historyAllowed, usePrefs, useWatchHistory, type Prefs } from '../lib/storage'
import { CloseIcon } from './icons'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import './pages.css'

// A switch that does not apply (it needs watch history) stays focusable, so the remote and screen
// readers still reach it and hear why, but shows off and ignores presses.
function Toggle({
  label,
  checked,
  disabled = false,
  onChange,
  children,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
  children: ReactNode
}) {
  const labelId = useId()
  const textId = useId()
  const on = checked && !disabled
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className={disabled ? 'opacity-70' : undefined}>
        <p id={labelId} className="font-medium text-ink">
          {label}
        </p>
        <p id={textId} className="mt-0.5 text-sm text-ink-2">
          {children}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={disabled || undefined}
        aria-labelledby={labelId}
        aria-describedby={textId}
        onClick={() => {
          if (!disabled) onChange(!checked)
        }}
        className="group inline-flex h-10 w-14 shrink-0 cursor-pointer items-center justify-center rounded-pill aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {/* Off: an outlined track with a grey knob; on: a forest track with a light knob. */}
        <span
          aria-hidden="true"
          className="relative h-6 w-11 rounded-pill border-2 border-ink-3 bg-surface transition-colors group-aria-checked:border-forest group-aria-checked:bg-forest motion-reduce:transition-none"
        >
          <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-ink-3 transition-[translate,background-color] group-aria-checked:translate-x-5 group-aria-checked:bg-on-accent motion-reduce:transition-none" />
        </span>
      </button>
    </div>
  )
}

/**
 * What is saved, with its Clear button in the switches' column (↑ / ↓ walk one column). The button
 * stays focusable, marked unavailable, once there is nothing left, so focus never drops.
 */
function ClearRow({
  status,
  count,
  onClear,
  children,
}: {
  status: string
  count: number
  onClear: () => void
  children: string
}) {
  const statusId = useId()
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p id={statusId} className="text-sm text-ink-2">
        {status}
      </p>
      <Button
        variant="secondary"
        size="sm"
        aria-describedby={statusId}
        aria-disabled={!count || undefined}
        onClick={count ? onClear : undefined}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {children}
      </Button>
    </div>
  )
}

const GROUP = 'mt-5 text-xs font-semibold tracking-wider text-ink-3 uppercase'

interface Opener {
  el: HTMLElement
  /** Its centre in page coordinates, and whether it sat in the page content. */
  x: number
  y: number
  inMain: boolean
}

function openerOf(active: Element | null): Opener | null {
  if (!(active instanceof HTMLElement) || active === document.body) return null
  const r = active.getBoundingClientRect()
  return {
    el: active,
    x: r.left + r.width / 2 + scrollX,
    y: r.top + r.height / 2 + scrollY,
    inMain: !!active.closest('main'),
  }
}

// Focus goes back to the control that opened the panel. When that went with its row (history
// switched off under "Manage history"), the nearest control to where it was takes over.
function returnFocus(opener: Opener | null) {
  if (!opener) return
  if (opener.el.isConnected) {
    opener.el.focus({ preventScroll: true })
    return
  }
  const root = (opener.inMain && document.getElementById('main')) || document
  let best: HTMLElement | undefined
  let bestDistance = Infinity
  for (const el of candidates(root)) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const d = Math.hypot(
      r.left + r.width / 2 + scrollX - opener.x,
      r.top + r.height / 2 + scrollY - opener.y,
    )
    if (d < bestDistance) {
      bestDistance = d
      best = el
    }
  }
  best?.focus({ preventScroll: true })
}

export default function PrivacyDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<Opener | null>(null)
  const titleId = useId()
  const [prefs, setPrefs] = usePrefs()
  const history = useWatchHistory()
  const searches = useSearchHistory()
  const historyOn = historyAllowed(prefs)

  useAppEvent(OPEN_PRIVACY_EVENT, () => {
    const el = dialog.current
    if (!el || el.open) return
    opener.current = openerOf(document.activeElement)
    el.showModal()
    // Each opening starts at the top (the element keeps its scroll position between openings).
    el.scrollTop = 0
  })

  const close = () => dialog.current?.close()
  const onClose = () => {
    returnFocus(opener.current)
    opener.current = null
  }
  // A click on the dialog element itself is a click on the backdrop.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }
  const set = (key: keyof Prefs) => (value: boolean) => setPrefs({ [key]: value })
  const seen = history.entries.length
  const watched = seen
    ? `${seen} ${seen === 1 ? 'video' : 'videos'} in your history.`
    : 'No watch history saved.'
  const asked = searches.searches.length
  const searched = asked
    ? `${asked} ${asked === 1 ? 'search' : 'searches'} saved.`
    : 'No searches saved.'
  const needsHistory = !prefs.history
    ? 'Needs “Save watch history”.'
    : !prefs.useHistory
      ? 'Needs “Use watch history for suggestions”.'
      : null

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={titleId}
      onClick={onClick}
      onClose={onClose}
      className="tv-sheet m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100%-2rem-2*var(--inset-x)))] overflow-y-auto overscroll-contain shell-scroll rounded-card border border-glass-border bg-surface p-0 text-ink shadow-(--shadow-elev-3) outline-none backdrop:bg-overlay motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:open:translate-y-2 motion-safe:starting:open:opacity-0"
    >
      {/* The title and Close stay in view while the panel scrolls (phones). */}
      <div className="tv-sheet-head sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-glass-border bg-surface px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
        <div>
          <p className="eyebrow">Privacy</p>
          <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
            History and personalization
          </h2>
        </div>
        <IconButton label="Close" icon={<CloseIcon />} onClick={close} className="-mt-1 -mr-2" />
      </div>
      <div className="px-5 pt-3 pb-5 sm:px-6 sm:pb-6">
        <p className="text-sm text-ink-2">
          Your watch history, searches and My List are kept only in this browser. Nothing is sent to
          a server.
        </p>

        <h3 className={GROUP}>Watch history</h3>
        <div className="divide-y divide-line">
          <Toggle label="Save watch history" checked={prefs.history} onChange={set('history')}>
            Remembers the videos you open. Turning it off deletes them, and any saved places.
          </Toggle>
          <Toggle
            label="Remember where I stopped"
            checked={prefs.resume}
            disabled={!prefs.history}
            onChange={set('resume')}
          >
            {prefs.history
              ? 'Each video resumes where you left it, with Play from start beside Play. Turning it off deletes the saved places.'
              : 'Needs “Save watch history”.'}
          </Toggle>
          <Toggle
            label="Use watch history for suggestions"
            checked={prefs.useHistory}
            disabled={!prefs.history}
            onChange={set('useHistory')}
          >
            {prefs.history
              ? 'Recently viewed, Because you watched, and picks in Recommended, Up next and More like this. Off: nothing on the site draws on your history.'
              : needsHistory}
          </Toggle>
          <ClearRow status={watched} count={history.entries.length} onClear={history.clear}>
            Clear history
          </ClearRow>
        </div>

        <h3 className={GROUP}>On the home page</h3>
        <div className="divide-y divide-line">
          <Toggle
            label="Recommended for you"
            checked={prefs.recommendations}
            onChange={set('recommendations')}
          >
            Personal picks from what you {pickSources(prefs)}.
          </Toggle>
          <Toggle
            label="Recently viewed"
            checked={prefs.recentlyViewed}
            disabled={!historyOn}
            onChange={set('recentlyViewed')}
          >
            {needsHistory ?? 'The videos you opened lately.'}
          </Toggle>
          <Toggle
            label="Because you watched"
            checked={prefs.becauseYouWatched}
            disabled={!historyOn}
            onChange={set('becauseYouWatched')}
          >
            {needsHistory ?? 'Titles close to the one you watched last.'}
          </Toggle>
        </div>

        <h3 className={GROUP}>Searches</h3>
        <div className="divide-y divide-line">
          <Toggle label="Save searches" checked={prefs.searches} onChange={set('searches')}>
            Remembers what you search for, to suggest related videos. Turning it off deletes saved
            searches.
          </Toggle>
          <ClearRow status={searched} count={searches.searches.length} onClear={searches.clear}>
            Clear searches
          </ClearRow>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <p className="text-xs leading-relaxed text-ink-3">
            My List stays until you remove titles from it.
          </p>
          <Button size="sm" onClick={close} className="ml-auto">
            Done
          </Button>
        </div>
      </div>
    </dialog>
  )
}
