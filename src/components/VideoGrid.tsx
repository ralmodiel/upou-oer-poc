import { useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { Video } from '../types'
import VideoCard from './VideoCard'

const LAYOUTS = {
  // Page grids sit right under the page h1; section grids under a section h2; compact under the modal's h3.
  page: {
    list: 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5',
    sizes: '(min-width: 96rem) 18vw, (min-width: 64rem) 23vw, (min-width: 48rem) 30vw, 45vw',
    heading: 'h2',
  },
  section: {
    list: 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-4',
    sizes: '(min-width: 64rem) 23vw, (min-width: 48rem) 30vw, 45vw',
    heading: 'h3',
  },
  compact: {
    list: 'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3',
    sizes: '(min-width: 48rem) 280px, (min-width: 40rem) 30vw, 45vw',
    heading: 'h4',
  },
} as const

const MOVES: Record<string, 'next' | 'prev' | 'down' | 'up' | 'first' | 'last'> = {
  ArrowRight: 'next',
  ArrowLeft: 'prev',
  ArrowDown: 'down',
  ArrowUp: 'up',
  Home: 'first',
  End: 'last',
}

const itemOf = (list: HTMLElement, target: EventTarget) => {
  const item = (target as HTMLElement).closest('li')
  return item?.parentElement === list ? item : null
}

const columnsOf = (list: HTMLElement) =>
  Math.max(1, getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length)

interface Props {
  videos: readonly Video[]
  layout?: keyof typeof LAYOUTS
  /** Defaults to false in category sections, where the heading names the collection. */
  showCategory?: boolean
}

// Roving tabindex: only one card per grid is in the Tab order (its link, then its Save and
// Details buttons); Arrow keys, Home and End move between cards and Tab leaves the grid.
export default function VideoGrid({ videos, layout = 'page', showCategory }: Props) {
  const { list, sizes, heading } = LAYOUTS[layout]
  const eyebrow = showCategory ?? layout !== 'section'
  const [current, setCurrent] = useState(0)
  const active = Math.min(current, videos.length - 1)

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const move = MOVES[e.key]
    if (!move || e.altKey || e.ctrlKey || e.metaKey) return
    const ul = e.currentTarget
    const item = itemOf(ul, e.target)
    if (!item) return
    const items = Array.from(ul.children) as HTMLElement[]
    const from = items.indexOf(item)
    const cols = columnsOf(ul)
    const to = {
      next: from + 1,
      prev: from - 1,
      down: from + cols,
      up: from - cols,
      first: 0,
      last: items.length - 1,
    }[move]
    if (to === from || to < 0 || to >= items.length) return
    e.preventDefault()
    items[to].querySelector<HTMLElement>('[data-card-link]')?.focus()
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
