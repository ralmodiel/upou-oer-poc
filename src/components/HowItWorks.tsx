// HowItWorks: three-card strip for first-time visitors (home page). "Got it" hides it and the choice
// is remembered under localStorage "upou:howitworks"; useHowItWorks().show() / useHelp() bring it
// back and focus the heading. Keyboard wording appears only on mouse/trackpad devices.
import { useEffect, useId, useRef } from 'react'
import { HOW_IT_WORKS_EVENT, takeHowItWorksFocus, useHowItWorks } from '../lib/howitworks'
import { openShortcuts, useAppEvent } from '../lib/shortcuts'
import { BookmarkIcon, CheckIcon, FilmIcon, GridIcon } from './icons'
import Button from './ui/Button'

const KBD =
  'rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-semibold text-ink'

const STEPS = [
  {
    Icon: FilmIcon,
    title: 'Every video opens with a 10-second preview',
    text: 'Press Skip to jump straight into the video.',
  },
  {
    Icon: BookmarkIcon,
    title: 'Save titles to My List',
    text: 'Use Save on any card; your list stays in this browser.',
  },
  {
    Icon: GridIcon,
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

export default function HowItWorks() {
  const { dismissed, dismiss } = useHowItWorks()
  const heading = useRef<HTMLHeadingElement>(null)
  const headingId = useId()

  const focusHeading = () => {
    if (!heading.current) return
    takeHowItWorksFocus()
    heading.current.focus()
  }
  useAppEvent(HOW_IT_WORKS_EVENT, focusHeading)
  // Asked for before the strip existed (Help from another page): focus once it is here.
  useEffect(() => {
    if (!dismissed && takeHowItWorksFocus()) heading.current?.focus()
  }, [dismissed])

  if (dismissed) return null

  return (
    <section aria-labelledby={headingId} className="border-b border-line bg-surface">
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
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex gap-3 rounded-card border border-line bg-paper p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-pill bg-maroon-soft text-maroon">
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
            className="cursor-pointer rounded-sm underline decoration-line underline-offset-4 hover:text-maroon hover:decoration-maroon"
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
