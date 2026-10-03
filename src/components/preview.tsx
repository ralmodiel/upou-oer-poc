import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from 'react'
import type { Video } from '../types'
import PromoReel from './PreviewReel'
import { canHover } from './browse-hooks'
import { prefersReducedMotion } from './hooks'

const HOVER_DELAY_MS = 800
const END_HOLD_MS = 1000

// Exactly one preview plays at a time: the card most recently hovered or focused.
let current: { id: string; stop: () => void } | null = null

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !current || e.defaultPrevented) return
  // Esc dismisses the preview before the app shell treats it as Back.
  e.preventDefault()
  current.stop()
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

/** Stops whichever preview is playing (dialogs opening, for instance). */
export const stopPreview = () => current?.stop()

type Phase = 'idle' | 'playing' | 'ending' | 'done'

/**
 * Preview reel for one card: mounts the muted reel in the card's 16:9 box when the card is
 * focused, or hovered for a moment on devices that hover; unmounts on blur, pointer leave or
 * Esc. After the reel ends its end card stays briefly, then the thumbnail returns until the
 * pointer leaves. Reduced motion: no automatic previews. Spread `hostProps` on the card and
 * render `overlay` inside its Thumbnail.
 */
export function useCardPreview(video: Video) {
  const [phase, setPhase] = useState<Phase>('idle')
  const hoverTimer = useRef(0)
  const endTimer = useRef(0)
  const { id } = video

  const stop = useCallback(() => {
    clearTimeout(hoverTimer.current)
    clearTimeout(endTimer.current)
    release(id)
    setPhase('idle')
  }, [id])

  const start = useCallback(() => {
    if (prefersReducedMotion()) return
    claim(id, stop)
    setPhase((p) => (p === 'idle' ? 'playing' : p))
  }, [id, stop])

  // Unmount (navigation) or another video in the same card: let go.
  useEffect(() => stop, [stop])

  const onComplete = useCallback(() => {
    clearTimeout(endTimer.current)
    setPhase('ending')
    endTimer.current = window.setTimeout(() => setPhase('done'), END_HOLD_MS)
  }, [])

  const previewing = phase === 'playing' || phase === 'ending'
  const hostProps = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !canHover()) return
      clearTimeout(hoverTimer.current)
      hoverTimer.current = window.setTimeout(start, HOVER_DELAY_MS)
    },
    onPointerLeave: stop,
    onFocus: start,
    onBlur: (e: FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) stop()
    },
    'data-previewing': previewing ? '' : undefined,
  }
  const overlay = previewing ? (
    <div aria-hidden="true" data-preview="" className="card-preview">
      <Suspense fallback={null}>
        <PromoReel video={video} variant="preview" muted onComplete={onComplete} />
      </Suspense>
    </div>
  ) : null

  return { hostProps, overlay, previewing }
}
