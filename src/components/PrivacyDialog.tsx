// PrivacyDialog: native modal <dialog> with the viewer's history and personalization switches.
// Opens on OPEN_PRIVACY_EVENT (`openPrivacy()` from the Help menu, the footer or a row's link).
// Everything it controls lives in this browser's localStorage. Mount once in AppLayout.
import { useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { useSearchHistory } from '../lib/history'
import { OPEN_PRIVACY_EVENT } from '../lib/privacy'
import { useAppEvent } from '../lib/shortcuts'
import { historyAllowed, usePrefs, useWatchHistory, type Prefs } from '../lib/storage'
import { CloseIcon } from './icons'
import Button from './ui/Button'
import IconButton from './ui/IconButton'

function Toggle({
  label,
  checked,
  disabled,
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
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className={disabled ? 'opacity-60' : undefined}>
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
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={textId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="group inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-pill disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="relative h-6 w-11 rounded-pill border border-line bg-surface-2 transition-colors group-aria-checked:border-transparent group-aria-checked:bg-forest"
        >
          <span className="absolute top-0.5 left-0.5 size-[18px] rounded-full bg-surface shadow transition-transform group-aria-checked:translate-x-5 motion-reduce:transition-none" />
        </span>
      </button>
    </div>
  )
}

const GROUP = 'mt-5 text-xs font-semibold tracking-wider text-ink-3 uppercase'

export default function PrivacyDialog() {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [prefs, setPrefs] = usePrefs()
  const history = useWatchHistory()
  const searches = useSearchHistory()
  const historyOn = historyAllowed(prefs)

  useAppEvent(OPEN_PRIVACY_EVENT, () => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  })

  const close = () => dialog.current?.close()
  // A click on the dialog element itself is a click on the backdrop.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }
  const set = (key: keyof Prefs) => (value: boolean) => setPrefs({ [key]: value })

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={titleId}
      onClick={onClick}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-card border border-line bg-surface p-0 text-ink shadow-lift outline-none backdrop:bg-overlay motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:open:translate-y-2 motion-safe:starting:open:opacity-0"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Privacy</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
              History and personalization
            </h2>
          </div>
          <IconButton label="Close" icon={<CloseIcon />} onClick={close} className="-mt-1 -mr-2" />
        </div>
        <p className="mt-2 text-sm text-ink-2">
          Your watch history, searches and My List are kept only in this browser. Nothing is sent to
          a server.
        </p>

        <h3 className={GROUP}>Watch history</h3>
        <div className="divide-y divide-line">
          <Toggle label="Save watch history" checked={prefs.history} onChange={set('history')}>
            Remembers the videos you open. Turning it off deletes the saved history.
          </Toggle>
          <Toggle
            label="Use watch history for suggestions"
            checked={prefs.useHistory}
            disabled={!prefs.history}
            onChange={set('useHistory')}
          >
            Recently viewed, Because you watched and history-based picks. Off: nothing on the site
            draws on your history.
          </Toggle>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={!history.entries.length}
          onClick={history.clear}
        >
          Clear watch history ({history.entries.length})
        </Button>

        <h3 className={GROUP}>On the home page</h3>
        <div className="divide-y divide-line">
          <Toggle
            label="Recommended for you"
            checked={prefs.recommendations}
            onChange={set('recommendations')}
          >
            Personal picks from your history, searches and My List.
          </Toggle>
          <Toggle
            label="Recently viewed"
            checked={prefs.recentlyViewed}
            disabled={!historyOn}
            onChange={set('recentlyViewed')}
          >
            {historyOn ? 'The videos you opened lately.' : 'Needs watch history.'}
          </Toggle>
          <Toggle
            label="Because you watched"
            checked={prefs.becauseYouWatched}
            disabled={!historyOn}
            onChange={set('becauseYouWatched')}
          >
            {historyOn ? 'Titles close to the one you watched last.' : 'Needs watch history.'}
          </Toggle>
        </div>

        <h3 className={GROUP}>Searches</h3>
        <Toggle label="Save searches" checked={prefs.searches} onChange={set('searches')}>
          Remembers what you search for, to suggest related videos. Turning it off deletes saved
          searches.
        </Toggle>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          disabled={!searches.searches.length}
          onClick={searches.clear}
        >
          Clear searches ({searches.searches.length})
        </Button>

        <p className="mt-5 text-xs leading-relaxed text-ink-3">
          My List stays until you remove titles from it.
        </p>
      </div>
    </dialog>
  )
}
