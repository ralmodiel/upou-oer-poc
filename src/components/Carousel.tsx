// Carousel: one home row that scrolls sideways (browse.css .row), its state from useCarousel
// (carousel-state.ts): the track and its Previous / Next buttons, and `CarouselDots`, the page dots
// for the row's heading.
import type { MouseEvent, ReactNode } from 'react'
import type { CarouselState } from './carousel-state'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

interface Props {
  carousel: CarouselState
  /** The row's name, for the button labels ("Next videos in Research"). */
  label: string
  /** Extra classes on the row (row-compact for smaller cards). */
  className?: string
  /** The list: a `ul` of fixed-width, snap-start items (VideoGrid layout="row"). */
  children: ReactNode
}

/**
 * The track and its buttons. Pointer devices show the buttons while the row is hovered or holds
 * focus, each at its end only while there is more that way; touch screens swipe instead. The
 * remote passes over the buttons (data-spatial="skip"): ← / → walk the cards, the track follows.
 */
export default function Carousel({ carousel, label, className = '', children }: Props) {
  const { ref, start, end, step, engage } = carousel
  return (
    <div className={`row group/row ${className}`} onPointerEnter={engage} onFocus={engage}>
      <RowButton
        side="prev"
        label={`Previous videos in ${label}`}
        hidden={start}
        onClick={(e) => step(-1, e.currentTarget)}
      />
      <div ref={ref} data-spatial="track" className="row-track">
        {children}
      </div>
      <RowButton
        side="next"
        label={`Next videos in ${label}`}
        hidden={end}
        onClick={(e) => step(1, e.currentTarget)}
      />
    </div>
  )
}

function RowButton({
  side,
  label,
  hidden,
  onClick,
}: {
  side: 'prev' | 'next'
  label: string
  hidden: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  const Icon = side === 'prev' ? ChevronLeftIcon : ChevronRightIcon
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      hidden={hidden}
      data-spatial="skip"
      onClick={onClick}
      className={`row-button row-${side} absolute z-30 hidden size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill border border-line bg-surface text-ink opacity-0 shadow-lift transition-[opacity,background-color] duration-200 group-focus-within/row:opacity-100 group-hover/row:opacity-100 hover:bg-surface-2 pointer-fine:grid`}
    >
      <Icon className="size-5" />
    </button>
  )
}

/** Decorative page dots beside a row's heading, on pointer devices (where the row has buttons). */
export function CarouselDots({ carousel }: { carousel: CarouselState }) {
  const { page, pages } = carousel
  if (pages < 2) return null
  return (
    <span aria-hidden="true" className="hidden items-center gap-1 pointer-fine:flex">
      {Array.from({ length: pages }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-pill ${i === page ? 'w-4 bg-maroon' : 'w-1.5 bg-ink-3/40'}`}
        />
      ))}
    </span>
  )
}
