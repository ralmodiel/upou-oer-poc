import { useLayoutEffect } from 'react'
import { prefersReducedMotion } from '../../components/hooks'

/** The stage's glide back to its place when the preview ends (watch.css), and the reveal's wait. */
export const GLIDE_MS = 600
// A smaller move than this is not worth a glide.
const MIN_SHIFT = 16
// Where the stage's centre sits, as a share of the room under the header: the optical centre, a
// little above the true middle, as a TV app frames its hero (three quarters down would push most
// of the player below the fold on a laptop).
export const CENTRE_AT = 0.45

/**
 * How far to lower the stage, in px, so its centre sits at `at` of the room between the header and
 * the phone's tab bar, whole in view. Never up, so when it does not fit (a phone on its side) it
 * stays put, and not at all on a page that opened scrolled or without a preview.
 */
export function centreShift({
  viewport,
  top,
  bottom,
  stageTop,
  stageHeight,
  skip,
  at = CENTRE_AT,
}: {
  viewport: number
  /** The header's height and the tab bar's. */
  top: number
  bottom: number
  /** The stage's place in the page, unscrolled. */
  stageTop: number
  stageHeight: number
  skip: boolean
  at?: number
}): number {
  if (skip) return 0
  const room = viewport - top - bottom
  const place = Math.min(top + room * at - stageHeight / 2, viewport - bottom - stageHeight)
  const shift = Math.round(place - stageTop)
  return shift >= MIN_SHIFT ? shift : 0
}

// The preview place worked out for each viewport size, so every preview, on the first page and on
// the pages chosen from it, starts in exactly the same spot (worked out again only on a resize).
const shifts = new Map<string, number>()
let swapTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Marks a page change made from the watch page (a row, autoplay) for its view transition
 * (watch.css): the text fades out as the stage glides to the preview place. False, with no mark,
 * under reduced motion or without view transitions, where the page simply changes.
 */
export function markWatchSwap(): boolean {
  if (prefersReducedMotion() || !('startViewTransition' in document)) return false
  const root = document.documentElement
  root.dataset.watchSwap = ''
  clearTimeout(swapTimer)
  swapTimer = setTimeout(() => delete root.dataset.watchSwap, 1500)
  return true
}

const rootPx = (name: string) => {
  const root = getComputedStyle(document.documentElement)
  const value = root.getPropertyValue(name).trim()
  return (parseFloat(value) || 0) * (value.endsWith('rem') ? parseFloat(root.fontSize) : 1)
}

/**
 * While the preview plays the stage sits in the middle of the viewport (watch.css). This measures
 * it and sets --watch-centre (the shift) and --watch-wait (the reveal's wait for the glide back) on
 * the watch page, again on resize. Layout values only (offsetTop), so the shift never measures
 * itself. Read just after commit, once the router has restored the page's scroll.
 */
export function useStageCentre() {
  useLayoutEffect(() => {
    let skip: boolean | undefined
    let live = true
    const measure = () => {
      const page = document.querySelector<HTMLElement>('.watch-page')
      const wrap = page?.querySelector<HTMLElement>('.watch-stage-wrap')
      const stage = wrap?.querySelector<HTMLElement>('.watch-stage')
      if (!live || !page || !wrap || !stage) return
      skip ??= scrollY > 0 || !stage.querySelector('.reel')
      const size = `${innerWidth}x${innerHeight}`
      const shift = skip
        ? 0
        : (shifts.get(size) ??
          centreShift({
            viewport: innerHeight,
            top: rootPx('--header-h'),
            bottom: rootPx('--tabbar-h'),
            stageTop: page.getBoundingClientRect().top + scrollY + wrap.offsetTop,
            stageHeight: stage.offsetHeight,
            skip,
          }))
      if (!skip) shifts.set(size, shift)
      page.style.setProperty('--watch-centre', `${shift}px`)
      page.style.setProperty('--watch-wait', `${shift ? GLIDE_MS : 0}ms`)
    }
    queueMicrotask(measure)
    addEventListener('resize', measure)
    return () => {
      live = false
      removeEventListener('resize', measure)
    }
  }, [])
}
