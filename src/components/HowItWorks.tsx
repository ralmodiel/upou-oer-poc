// HowItWorks: three-card strip for first-time visitors (home page). "Got it" hides it and the choice
// is remembered under localStorage "upou:howitworks"; useHowItWorks().show() / useHelp() bring it
// back, scroll it into view with a short gold highlight and focus the heading. HowItWorksChip opens
// it from the home intro band, near the top. Keyboard wording appears only on mouse/trackpad devices.
import { useEffect, useId, useRef } from 'react'
import { HOW_IT_WORKS_EVENT, takeHowItWorksFocus, useHelp, useHowItWorks } from '../lib/howitworks'
import { openShortcuts, useAppEvent } from '../lib/shortcuts'
import { prefersReducedMotion } from './hooks'
import { BookmarkIcon, CheckIcon, FilmIcon, GridIcon, HelpIcon } from './icons'
import Button from './ui/Button'

const KBD =
  'rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-semibold text-ink'

const STEPS = [
  {
    Icon: FilmIcon,
    tone: 'bg-maroon-soft text-maroon',
    title: 'Video opens with a 10-second preview',
    text: 'Press Skip to jump straight into the video.',
  },
  {
    Icon: BookmarkIcon,
    tone: 'bg-band-gold text-charcoal',
    title: 'Save titles to My List',
    text: 'Use Save on any card; your list stays in this browser.',
  },
  {
    Icon: GridIcon,
    tone: 'bg-forest-soft text-forest',
    title: 'Browse by collection or search everything',
    text: (
      <>
        Collections group videos by topic.{' '}
        <span className="pointer-fine:hidden">Use Search to find anything.</span>
        <span className="hidden pointer-fine:inline">
          Press <kbd className={KBD}>/</kbd> anywhere to search.
        </span>
      </>
    ),
  },
]

// Brought into view (smoothly unless reduced motion), its heading focused and the strip briefly
// outlined in gold (browse.css), so a press of Help or the intro chip shows where it landed.
function reveal(section: HTMLElement | null, heading: HTMLElement) {
  heading.focus({ preventScroll: true })
  heading.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  if (!section) return
  delete section.dataset.arrived
  void section.offsetWidth
  section.dataset.arrived = ''
}

export default function HowItWorks() {
  const { dismissed, dismiss } = useHowItWorks()
  const section = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const headingId = useId()

  const focusHeading = () => {
    if (!heading.current) return
    takeHowItWorksFocus()
    reveal(section.current, heading.current)
  }
  useAppEvent(HOW_IT_WORKS_EVENT, focusHeading)
  // Asked for before the strip existed (Help from another page): focus once it is here, after
  // the router's scroll restoration so the focus scroll is the one that lasts.
  useEffect(() => {
    if (dismissed || !takeHowItWorksFocus()) return
    const frame = requestAnimationFrame(() => {
      if (heading.current) reveal(section.current, heading.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [dismissed])

  if (dismissed) return null

  return (
    <section
      ref={section}
      aria-labelledby={headingId}
      onAnimationEnd={(e) => {
        delete e.currentTarget.dataset.arrived
      }}
      className="how-strip border-b border-line bg-surface"
    >
      <div className="px-(--gutter) py-5 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">How it works</p>
            <h2
              ref={heading}
              id={headingId}
              tabIndex={-1}
              className="mt-1 font-display text-xl leading-tight text-ink sm:text-2xl"
            >
              UPOU OER — Open Educational Resources, in three steps
            </h2>
          </div>
          <Button variant="ghost" size="sm" icon={<CheckIcon />} onClick={dismiss}>
            Got it
          </Button>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ Icon, tone, title, text }, i) => (
            <li
              key={title}
              className="flex gap-3 rounded-card border border-line bg-paper p-4 dark:bg-surface-2"
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-pill ${tone}`}>
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-ink">
                  <span className="sr-only">Step {i + 1}: </span>
                  {title}
                </p>
                <p className="mt-0.5 text-sm text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 hidden text-sm text-ink-3 pointer-fine:block">
          Keyboard or TV remote: the arrow keys move around, Enter opens, Esc goes back.{' '}
          <button
            type="button"
            onClick={openShortcuts}
            className="-my-2.5 inline-block cursor-pointer rounded-sm py-2.5 underline decoration-line underline-offset-4 hover:text-maroon hover:decoration-maroon"
          >
            All shortcuts
          </button>
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<CheckIcon />}
          onClick={dismiss}
          className="mt-4 w-full sm:hidden"
        >
          Got it
        </Button>
      </div>
    </section>
  )
}

/** Opens the strip from the home intro band (on a maroon band: paper outline, gold focus ring). */
export function HowItWorksChip() {
  const help = useHelp()
  return (
    <button
      type="button"
      onClick={help}
      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-pill border border-on-band/45 px-4 text-sm font-semibold text-on-band transition-[background-color,border-color,translate] duration-200 hover:border-on-band/80 hover:bg-on-band/10 motion-safe:active:translate-y-px"
    >
      <HelpIcon className="size-4" />
      How it works
    </button>
  )
}
