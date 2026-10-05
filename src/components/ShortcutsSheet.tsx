// ShortcutsSheet: native modal <dialog> listing the app's keys (keyboard or TV remote). Opens on
// OPEN_SHORTCUTS_EVENT (the `?` key, or `openShortcuts()` from a link). Mount once in AppLayout.
import { useId, useRef, type MouseEvent } from 'react'
import { OPEN_SHORTCUTS_EVENT, useAppEvent } from '../lib/shortcuts'
import { CloseIcon } from './icons'
import IconButton from './ui/IconButton'
import './pages.css'

const KEYS: { keys: string[]; text: string }[] = [
  { keys: ['←', '→', '↑', '↓'], text: 'Move the highlight to the nearest card or control' },
  {
    keys: ['↓', '↑'],
    text: '↓ from a card goes on to the next row; ↑ straight after, to its Save',
  },
  { keys: ['←', '→'], text: 'Along a row of chips (↑ or ↓ leaves the row)' },
  { keys: ['Enter'], text: 'Open the highlighted video or press the control' },
  { keys: ['Esc', 'Backspace'], text: 'Back: closes an open panel first, then the previous page' },
  { keys: ['Tab'], text: 'Next control; in a grid it moves on past the cards (Shift + Tab: back)' },
  { keys: ['Home', 'End'], text: 'First or last card in a grid' },
  { keys: ['PgUp', 'PgDn'], text: 'Previous or next section of the page' },
  { keys: ['/'], text: 'Jump to search' },
  { keys: ['?'], text: 'Show this sheet' },
]

export default function ShortcutsSheet() {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useAppEvent(OPEN_SHORTCUTS_EVENT, () => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  })

  const close = () => dialog.current?.close()
  // A click on the dialog element itself is a click on the backdrop.
  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) close()
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      aria-labelledby={titleId}
      onClick={onClick}
      className="tv-sheet m-auto w-[min(28rem,calc(100%-2rem-2*var(--inset-x)))] shell-scroll rounded-card border border-glass-border bg-surface p-0 text-ink shadow-(--shadow-elev-3) outline-none backdrop:bg-overlay motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:open:translate-y-2 motion-safe:starting:open:opacity-0"
    >
      <div className="p-5 sm:p-6">
        <div className="tv-sheet-bar flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Keyboard and remote</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
              Shortcuts
            </h2>
          </div>
          <IconButton label="Close" icon={<CloseIcon />} onClick={close} className="-mt-1 -mr-2" />
        </div>
        <p className="mt-2 text-sm text-ink-2">
          The arrow keys of a keyboard or a TV remote move a highlight around the whole page.
        </p>
        <dl className="mt-3 divide-y divide-line text-sm">
          {KEYS.map(({ keys, text }) => (
            <div key={text} className="flex items-center gap-4 py-2.5">
              <dt className="flex w-24 shrink-0 flex-wrap gap-1">
                {keys.map((key) => (
                  <kbd
                    key={key}
                    className="inline-block min-w-7 rounded-md border border-glass-border bg-surface-2 px-1.5 py-0.5 text-center font-sans text-xs font-semibold text-ink"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-ink-2">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          Inside the video, Space, K and the arrow keys belong to YouTube&apos;s player; click the
          player first to use them.
        </p>
      </div>
    </dialog>
  )
}
