// HowItWorks: three-card strip for first-time visitors (home page). "Got it" hides it and the choice
// is remembered under localStorage "upou:howitworks"; useHowItWorks().show() brings it back.
import { useHowItWorks } from '../lib/howitworks'
import { BookmarkIcon, CheckIcon, FilmIcon, GridIcon } from './icons'
import Button from './ui/Button'

const STEPS = [
  {
    Icon: FilmIcon,
    title: 'Every video opens with a 10-second preview reel',
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
    text: 'Collections group videos by topic; press / to search from anywhere.',
  },
]

export default function HowItWorks() {
  const { dismissed, dismiss } = useHowItWorks()
  if (dismissed) return null

  return (
    <section aria-label="How it works" className="border-b border-line bg-surface">
      <div className="px-(--gutter) py-5 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <p className="eyebrow">How it works</p>
          <Button variant="ghost" size="sm" icon={<CheckIcon />} onClick={dismiss}>
            Got it
          </Button>
        </div>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
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
      </div>
    </section>
  )
}
