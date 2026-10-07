import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react'
import { prefetchWatch } from '../features/reel/preload'
import { reelWorks } from '../lib/lite'
import { lastInput } from '../lib/pointer'
import type { Video } from '../types'
import PromoReel from './PreviewReel'
import { canHover, onIdle, whenImagesSettled } from './browse-hooks'
import { prefersReducedMotion } from './hooks'

const HOVER_DELAY_MS = 800
const END_HOLD_MS = 1000

// Exactly one preview plays at a time: the card most recently hovered or focused.
let current: { id: string; stop: () => void } | null = null

// Esc stops the preview and still means Back: the app shell's handler runs next.
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') current?.stop()
}

function claim(id: string, stop: () => void) {
  if (current?.id === id) {
    current.stop = stop
    return
  }
  current?.stop()
  document.addEventListener('keydown', onKeyDown, true)
  current = { id, stop }
}

function release(id: string) {
  if (current?.id !== id) return
  current = null
  document.removeEventListener('keydown', onKeyDown, true)
}

// The reel chunk (shared with the watch page), fetched once: when the browser is first idle after a
// card mounts and the pictures on screen have arrived (with the watch page's), or at the first hover
// or focus on a card, so a preview never waits on the network.
let reelRequested = false
let idleScheduled = false
function prefetchReel() {
  if (reelRequested) return
  reelRequested = true
  import('../features/reel/PromoReel').catch(() => {
    reelRequested = false
  })
}
function prefetchReelWhenIdle() {
  if (idleScheduled || reelRequested) return
  idleScheduled = true
  // Not before the pictures on screen have arrived: on a slow link the chunks took its bandwidth.
  whenImagesSettled(() =>
    onIdle(() => {
      prefetchReel()
      prefetchWatch()
    }, 4000),
  )
}

/** Stops whichever preview is playing (dialogs opening, for instance). */
export const stopPreview = () => current?.stop()

type Phase = 'idle' | 'playing' | 'ending' | 'done'

/**
 * Preview reel for one card: mounts the muted reel in the card's 16:9 box when the card is
 * focused, or hovered for a moment on devices that hover (outside dialogs); unmounts on blur,
 * pointer leave or Esc. After the reel ends its end card stays briefly, then the thumbnail returns
 * until the pointer leaves. Reduced motion: no automatic previews. Spread `hostProps` on the card and
 * render `overlay` inside its Thumbnail; `start` / `stop` let a viewer play it on selection.
 */
export function useCardPreview(video: Video) {
  const [phase, setPhase] = useState<Phase>('idle')
  const hoverTimer = useRef(0)
  const endTimer = useRef(0)
  const host = useRef<HTMLElement | null>(null)
  // After a finished reel the thumbnail stays until the pointer or focus leaves the card.
  const done = useRef(false)
  const { id } = video

  const stop = useCallback(() => {
    clearTimeout(hoverTimer.current)
    clearTimeout(endTimer.current)
    done.current = false
    release(id)
    setPhase('idle')
  }, [id])

  // Every video previews: one with no clean image plays the reel's type-only title card.
  const start = useCallback(() => {
    if (!reelWorks || prefersReducedMotion() || done.current) return
    claim(id, stop)
    setPhase((p) => (p === 'idle' ? 'playing' : p))
  }, [id, stop])

  useEffect(prefetchReelWhenIdle, [])

  // Unmount (navigation) or another video in the same card: let go.
  useEffect(() => stop, [stop])

  const onComplete = useCallback(() => {
    clearTimeout(endTimer.current)
    setPhase('ending')
    endTimer.current = window.setTimeout(() => {
      // Nothing left to dismiss: Esc is the app's again.
      done.current = true
      release(id)
      setPhase('done')
    }, END_HOLD_MS)
  }, [id])

  const previewing = phase === 'playing' || phase === 'ending'

  // Once in view, a preview stops when its card leaves it (a row paged on, the page scrolled).
  useEffect(() => {
    const el = host.current
    if (!previewing || !el) return
    let seen = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) seen = true
        else if (seen) stop()
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [previewing, stop])

  const hostProps = {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'touch' || !canHover()) return
      // A dialog opens (or scrolls) under a still pointer: its cards preview on keyboard focus only.
      if (e.currentTarget.closest('dialog[open]')) return
      host.current = e.currentTarget
      prefetchReel()
      clearTimeout(hoverTimer.current)
      hoverTimer.current = window.setTimeout(start, HOVER_DELAY_MS)
    },
    onPointerLeave: stop,
    // Focus previews follow keyboard focus only: a click on a card's button, or the focus "Load
    // more" gives the first new card after a click, plays nothing (pointers get hover previews).
    onFocus: (e: FocusEvent<HTMLElement>) => {
      host.current = e.currentTarget
      prefetchReel()
      if (lastInput() !== 'pointer') start()
    },
    onBlur: (e: FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stop()
    },
    'data-previewing': previewing ? '' : undefined,
  }
  const overlay = previewing ? (
    <div
      aria-hidden="true"
      data-preview=""
      data-ending={phase === 'ending' ? '' : undefined}
      className="card-preview"
    >
      <Suspense fallback={null}>
        <PromoReel video={video} variant="preview" muted onComplete={onComplete} />
      </Suspense>
      {/* The reel's progress along a card's foot (browse.css). */}
      <span className="card-preview-bar" />
    </div>
  ) : null

  return { hostProps, overlay, previewing, start, stop }
}
