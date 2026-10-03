import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Thumbnail from '../../components/Thumbnail'
import Button from '../../components/ui/Button'
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
 * Play now and Cancel. A light card whatever the theme, never a dark box. Cancel takes focus, so a
 * remote's OK stops it (unless the viewer is typing or in a dialog); the Back keys, Esc and
 * Backspace, cancel too, before the app would treat them as Back. An open dialog keeps its Esc.
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

  return (
    <div
      ref={rootRef}
      role="group"
      aria-labelledby="autoplay-next-label autoplay-next-title"
      className="watch-autoplay absolute inset-0 z-20 grid place-items-center p-[4%] @container"
    >
      <div className="flex w-full max-w-3xl items-center gap-[4cqi]">
        <Thumbnail
          video={next}
          sizes="(min-width: 1024px) 320px, 40vw"
          loading="eager"
          className="w-[38%] shrink-0 rounded-lg ring-1 ring-black/5"
        />
        <div className="min-w-0">
          <p
            id="autoplay-next-label"
            className="text-[length:clamp(0.7rem,2.4cqi,0.95rem)] font-semibold tracking-wide text-forest uppercase"
          >
            Next
            <span className="text-ink-2 tabular-nums" aria-hidden="true">
              {' '}
              · {left}
            </span>
            <span className="sr-only">, playing in {AUTOPLAY_SECONDS} seconds</span>
          </p>
          <p
            id="autoplay-next-title"
            className="mt-[1cqi] line-clamp-2 font-display text-[length:clamp(1rem,4.2cqi,2.25rem)] leading-tight text-ink"
          >
            {next.title}
          </p>
          <span
            aria-hidden="true"
            className="watch-autoplay-bar mt-[2cqi] block h-1 rounded-pill"
          />
          <div className="mt-[2.5cqi] flex flex-wrap gap-2">
            <Button size="sm" onClick={onPlay}>
              Play now
            </Button>
            <Button data-cancel="" variant="secondary" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
