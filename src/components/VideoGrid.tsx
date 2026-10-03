import { useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { Video } from '../types'
import VideoCard from './VideoCard'

// Card widths: the columns of the 92vw content box (4vw gutters, 1600px at most) less the 1rem
// gaps, so a 320px still is chosen wherever it is big enough.
const LAYOUTS = {
  // Page grids sit right under the page h1; section grids under a section h2; compact under the modal's h3.
  page: {
    list: 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5',
    sizes:
      '(min-width: 108rem) 307px, (min-width: 96rem) calc(18.4vw - 13px), (min-width: 64rem) calc(23vw - 12px), (min-width: 48rem) calc(30.7vw - 11px), calc(46vw - 8px)',
    heading: 'h2',
  },
  section: {
    list: 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4',
    sizes:
      '(min-width: 108rem) 388px, (min-width: 64rem) calc(23vw - 12px), (min-width: 48rem) calc(30.7vw - 11px), calc(46vw - 8px)',
    heading: 'h3',
  },
  compact: {
    list: 'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3',
    sizes: '(min-width: 48rem) 280px, (min-width: 40rem) 30vw, 45vw',
    heading: 'h4',
  },
} as const

const itemOf = (list: HTMLElement, target: EventTarget) => {
  const item = (target as HTMLElement).closest('li')
  return item?.parentElement === list ? item : null
}

interface Props {
  videos: readonly Video[]
  layout?: keyof typeof LAYOUTS
  /** Defaults to false in category sections, where the heading names the collection. */
  showCategory?: boolean
}

// Roving tabindex: only one card per grid is in the Tab order (its link, then its Save and
// Details buttons), so Tab leaves the grid. The arrow keys move between cards through spatial
// navigation (lib/spatial.ts, which treats each card as one target); Home and End jump to the
// first and last card.
export default function VideoGrid({ videos, layout = 'page', showCategory }: Props) {
  const { list, sizes, heading } = LAYOUTS[layout]
  const eyebrow = showCategory ?? layout !== 'section'
  const [current, setCurrent] = useState(0)
  const active = Math.min(current, videos.length - 1)

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if ((e.key !== 'Home' && e.key !== 'End') || e.altKey || e.ctrlKey || e.metaKey) return
    const ul = e.currentTarget
    if (!itemOf(ul, e.target)) return
    const item = e.key === 'Home' ? ul.firstElementChild : ul.lastElementChild
    const link = item?.querySelector<HTMLElement>('[data-card-link]')
    if (!link || link === e.target) return
    e.preventDefault()
    link.focus()
  }

  // Remember the card the user reached (by keyboard or pointer) as the grid's entry point.
  const onFocus = (e: FocusEvent<HTMLUListElement>) => {
    const item = itemOf(e.currentTarget, e.target)
    if (!item) return
    const index = Array.prototype.indexOf.call(e.currentTarget.children, item)
    if (index !== active) setCurrent(index)
  }

  return (
    <ul role="list" className={list} onKeyDown={onKeyDown} onFocus={onFocus}>
      {videos.map((video, i) => (
        <li key={video.id}>
          <VideoCard
            video={video}
            sizes={sizes}
            heading={heading}
            active={i === active}
            showCategory={eyebrow}
          />
        </li>
      ))}
    </ul>
  )
}
