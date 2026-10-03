// ShortcutsSheet: native modal <dialog> listing the app's keys. Opens on OPEN_SHORTCUTS_EVENT
// (the `?` key, or `openShortcuts()` from a link). Mount once in AppLayout.
import { useId, useRef, type MouseEvent } from 'react'
import { OPEN_SHORTCUTS_EVENT, useAppEvent } from '../lib/shortcuts'
import { CloseIcon } from './icons'
import IconButton from './ui/IconButton'

const KEYS: [string, string][] = [
  ['Esc', 'Back: closes an open dialog first, then returns to the previous page'],
  ['/', 'Jump to search'],
  ['?', 'Show this sheet'],
  ['Tab', 'Move between cards and controls; Enter opens'],
  ['← →', 'Move between videos in a grid or chips in a row (↑ ↓ by row, Home / End to jump)'],
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
      aria-labelledby={titleId}
      onClick={onClick}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-card border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-overlay motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:open:translate-y-2 motion-safe:starting:open:opacity-0"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Keyboard</p>
            <h2 id={titleId} className="mt-1 font-display text-2xl leading-tight">
              Shortcuts
            </h2>
          </div>
          <IconButton label="Close" icon={<CloseIcon />} onClick={close} className="-mt-1 -mr-2" />
        </div>
        <dl className="mt-4 divide-y divide-line text-sm">
          {KEYS.map(([key, text]) => (
            <div key={key} className="flex items-center gap-4 py-2.5">
              <dt className="w-14 shrink-0">
                <kbd className="inline-block min-w-7 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-center font-sans text-xs font-semibold text-ink">
                  {key}
                </kbd>
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
