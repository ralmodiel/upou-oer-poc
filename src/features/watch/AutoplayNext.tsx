import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { PlayIcon } from '../../components/icons'
import Thumbnail from '../../components/Thumbnail'
import Button from '../../components/ui/Button'
import { formatDate } from '../../lib/format'
import { isEditable, topDialog } from '../../lib/shortcuts'
import type { Video } from '../../types'
import './watch.css'

export const AUTOPLAY_SECONDS = 5

interface Props {
  next: Video
  /** Go to the next video (at zero, or on Play now). */
  onPlay: () => void
  /** Stop this countdown only (Cancel, Esc or Backspace). */
  onCancel: () => void
}

/**
 * Shown on the stage when a video ends with autoplay on: the next video, a five-second countdown,
 * Play now and Cancel. A light card whatever the theme, never a dark box, set like the reel's end
 * card (eyebrow, serif title, facts, "Starting in", a progress bar along the bottom). Cancel takes
 * focus, so a remote's OK stops it (unless the viewer is typing or in a dialog); the Back keys, Esc
 * and Backspace, cancel too, before the app would treat them as Back. An open dialog keeps its Esc.
 */
export default function AutoplayNext({ next, onPlay, onCancel }: Props) {
  const [left, setLeft] = useState(AUTOPLAY_SECONDS)
  const rootRef = useRef<HTMLDivElement>(null)
  const play = useEffectEvent(onPlay)
  const cancel = useEffectEvent(onCancel)

  useEffect(() => {
    const active = document.activeElement
    if (!isEditable(active) && !topDialog())
      rootRef.current?.querySelector<HTMLElement>('[data-cancel]')?.focus({ preventScroll: true })
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || topDialog()) return
      if (e.key !== 'Escape' && (e.key !== 'Backspace' || isEditable(e.target))) return
      e.preventDefault()
      cancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // One timer goes on to the next video; the other only updates the seconds shown.
  useEffect(() => {
    const go = setTimeout(() => play(), AUTOPLAY_SECONDS * 1000)
    const tick = setInterval(() => setLeft((n) => Math.max(1, n - 1)), 1000)
    return () => {
      clearTimeout(go)
      clearInterval(tick)
    }
  }, [])

  const facts = [next.category, formatDate(next.publishedAt)].filter(Boolean).join(' · ')
  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby="autoplay-next-label autoplay-next-title"
      className="watch-autoplay absolute inset-0 z-20 grid place-items-center @container"
    >
      <div className="watch-autoplay-body">
        <Thumbnail
          video={next}
          sizes="(min-width: 1024px) 320px, 40vw"
          loading="eager"
          className="watch-autoplay-thumb rounded-lg ring-1 ring-black/5"
        />
        <div className="watch-autoplay-copy">
          <p id="autoplay-next-label" className="watch-autoplay-eyebrow">
            <span aria-hidden="true">Up next</span>
            <span className="sr-only">Up next, playing in {AUTOPLAY_SECONDS} seconds</span>
          </p>
          <p id="autoplay-next-title" className="watch-autoplay-title">
            {next.title}
          </p>
          {facts && <p className="watch-autoplay-facts">{facts}</p>}
          {/* The seconds, seen only: the group's name says it once for screen readers. */}
          <p className="watch-autoplay-count" aria-hidden="true">
            Starting in
            <span key={left} className="watch-autoplay-digit">
              {left}
            </span>
          </p>
        </div>
        <div className="watch-autoplay-actions">
          <Button size="sm" icon={<PlayIcon />} onClick={onPlay}>
            Play now
          </Button>
          <Button data-cancel="" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      <span aria-hidden="true" className="watch-autoplay-bar" />
    </div>
  )
}
