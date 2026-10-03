import { memo, useEffect, useId, useRef, useState, type FocusEvent } from 'react'
import { Link } from 'react-router'
import type { Video } from '../types'
import VideoCard from './VideoCard'
import { prefersReducedMotion } from './hooks'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

// Mirrors the --n cards-per-view steps in browse.css.
const SIZES =
  '(min-width: 96rem) 15vw, (min-width: 80rem) 17vw, (min-width: 64rem) 20vw, (min-width: 40rem) 28vw, 39vw'

type Edge = 'start' | 'middle' | 'end' | 'none'

function edgeOf(el: HTMLElement): Edge {
  const max = el.scrollWidth - el.clientWidth
  if (max <= 2) return 'none'
  if (el.scrollLeft <= 2) return 'start'
  return el.scrollLeft >= max - 2 ? 'end' : 'middle'
}

function metrics(el: HTMLElement) {
  const style = getComputedStyle(el)
  return { gap: parseFloat(style.columnGap) || 0, pad: parseFloat(style.paddingLeft) || 0 }
}

const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'instant' : 'smooth')

interface Props {
  title: string
  videos: readonly Video[]
  /** Link to the whole collection when the row shows only part of it. */
  seeAll?: string
  /** Size of the whole collection, for the link's accessible name. */
  total?: number
}

function Row({ title, videos, seeAll, total }: Props) {
  const headingId = useId()
  const track = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState<Edge>('start')
  const hasVideos = videos.length > 0

  useEffect(() => {
    const el = track.current
    if (!el) return
    const observer = new ResizeObserver(() => setEdge(edgeOf(el)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasVideos])

  if (!hasVideos) return null

  // Scroll by the number of fully visible cards so the partly visible one leads the next page.
  const page = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const { gap, pad } = metrics(el)
    const inner = el.clientWidth - 2 * pad
    const step = (el.firstElementChild?.getBoundingClientRect().width ?? inner) + gap
    const cards = Math.max(1, Math.floor((inner + gap) / step))
    el.scrollBy({ left: dir * cards * step, behavior: scrollBehavior() })
  }

  // Native focus scrolling ignores the gutter and can snap back, leaving the peeking card
  // clipped. After it runs, move whole cards until the keyboard-focused card fits.
  const reveal = (e: FocusEvent<HTMLUListElement>) => {
    const el = e.currentTarget
    const target = e.target as HTMLElement
    const card = target.closest('li')
    if (!card || !target.matches(':focus-visible')) return
    requestAnimationFrame(() => {
      const { gap, pad } = metrics(el)
      const view = el.getBoundingClientRect()
      const box = card.getBoundingClientRect()
      const step = box.width + gap
      const before = box.left - (view.left + pad)
      const after = box.right - (view.right - pad)
      const left = before < -1 ? before : after > 1 ? Math.ceil(after / step) * step : 0
      if (left) el.scrollBy({ left, behavior: scrollBehavior() })
    })
  }

  return (
    <section aria-labelledby={headingId} className="browse-row group/row relative">
      <div className="flex items-baseline gap-3 px-(--gutter)">
        <h2
          id={headingId}
          className="line-clamp-2 text-base font-semibold tracking-tight text-neutral-100 sm:text-lg lg:text-xl"
        >
          {title}
        </h2>
        {seeAll && (
          <Link
            to={seeAll}
            aria-label={total ? `See all ${total} titles in ${title}` : `See all of ${title}`}
            className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-neutral-400 transition-colors hover:text-white sm:text-sm"
          >
            See all
            <ChevronRightIcon className="size-3.5" />
          </Link>
        )}
      </div>
      <div className="relative">
        <ul
          ref={track}
          role="list"
          onScroll={(e) => setEdge(edgeOf(e.currentTarget))}
          onFocus={reveal}
          className="flex snap-x snap-mandatory gap-(--gap) overflow-x-auto overscroll-x-contain scroll-px-(--gutter) px-(--gutter) pt-3 pb-6 scrollbar-none"
        >
          {videos.map((video) => (
            <li key={video.id} className="w-(--card-w) flex-none snap-start">
              <VideoCard video={video} sizes={SIZES} />
            </li>
          ))}
        </ul>
        <ScrollButton
          side="left"
          label={`Scroll ${title} back`}
          hidden={edge === 'start' || edge === 'none'}
          onClick={() => page(-1)}
        />
        <ScrollButton
          side="right"
          label={`Scroll ${title} forward`}
          hidden={edge === 'end' || edge === 'none'}
          onClick={() => page(1)}
        />
      </div>
    </section>
  )
}

interface ScrollButtonProps {
  side: 'left' | 'right'
  label: string
  hidden: boolean
  onClick: () => void
}

// Pointer affordance only: keyboard users move through the cards, which scroll into view.
function ScrollButton({ side, label, hidden, onClick }: ScrollButtonProps) {
  const left = side === 'left'
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className={`group/scroll absolute top-3 z-40 hidden h-[calc(var(--card-w)*9/16)] w-(--gutter) items-center justify-center from-ink-950/90 to-ink-950/30 text-white opacity-0 transition-opacity duration-300 ease-cinematic group-hover/row:opacity-100 [@media(hover:hover)]:flex ${
        left ? 'left-0 rounded-r-md bg-linear-to-r' : 'right-0 rounded-l-md bg-linear-to-l'
      } ${hidden ? 'invisible' : ''}`}
    >
      {left ? (
        <ChevronLeftIcon className="size-7 transition-transform duration-200 ease-cinematic group-hover/scroll:scale-125" />
      ) : (
        <ChevronRightIcon className="size-7 transition-transform duration-200 ease-cinematic group-hover/scroll:scale-125" />
      )}
    </button>
  )
}

export default memo(Row)
