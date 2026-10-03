// Menu: a small dropdown — a trigger button and a popup of actions in `sections`. An item with
// `checked` set is a radio item (aria-checked). Keyboard: Enter/Space opens and focuses the first
// item, ↑ ↓ move (wrapping), Home/End jump, Esc closes and refocuses the trigger, Tab or focus
// leaving closes. The popup owns its arrow keys (role=menu), so spatial navigation stays out.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { CheckIcon } from '../icons'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  checked?: boolean
  /** Small trailing note, e.g. the key that does the same. */
  hint?: string
}

export interface MenuSection {
  title?: string
  items: MenuItem[]
}

export interface MenuProps {
  /** Accessible name of the trigger, also its tooltip. */
  label: string
  /** Trigger content: an icon, text or both. */
  children: ReactNode
  sections: MenuSection[]
  triggerClassName?: string
  className?: string
}

const ITEM =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink aria-checked:font-semibold aria-checked:text-maroon [&>svg]:size-4.5 [&>svg]:shrink-0'

export default function Menu({
  label,
  children,
  sections,
  triggerClassName = '',
  className = '',
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const id = useId()

  const items = () =>
    Array.from(popup.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])

  const close = (refocus = false) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Once open: focus the first item; a press outside closes.
  useEffect(() => {
    if (!open) return
    popup.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const index = list.indexOf(e.target as HTMLElement)
    const go = (i: number) => {
      e.preventDefault()
      list[(i + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(index + 1)
    else if (e.key === 'ArrowUp') go(index - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'Tab') setOpen(false)
  }

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!root.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div ref={root} className={`relative ${className}`} onBlur={onBlur}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {children}
      </button>
      {open && (
        <div
          ref={popup}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-50 mt-1.5 min-w-60 rounded-card border border-line bg-surface p-1.5 text-sm shadow-lift motion-safe:transition-[opacity,translate] motion-safe:duration-150 motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0"
        >
          {sections.map((section, i) => (
            <div
              key={section.title ?? i}
              role="group"
              aria-label={section.title}
              className={i > 0 ? 'mt-1 border-t border-line pt-1' : undefined}
            >
              {section.title && (
                <p aria-hidden="true" className="eyebrow px-2.5 pt-2 pb-1">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                  aria-checked={item.checked}
                  tabIndex={-1}
                  onClick={() => {
                    close(true)
                    item.onSelect()
                  }}
                  className={ITEM}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.checked && <CheckIcon className="text-maroon" />}
                  {item.hint && (
                    <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-semibold text-ink-3">
                      {item.hint}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
