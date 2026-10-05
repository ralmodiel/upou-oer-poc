import { useLayoutEffect } from 'react'
import { prefersReducedMotion } from '../../components/hooks'

/** The stage's glide back to its place when the preview ends (watch.css), and the reveal's wait. */
const GLIDE_MS = 600
// A smaller move than this is not worth a glide.
const MIN_SHIFT = 16
// Where the stage's centre sits, as a share of the room under the header: the optical centre, a
// little above the true middle, as a TV app frames its hero (three quarters down would push most
// of the player below the fold on a laptop).
const CENTRE_AT = 0.45
// The longest a page change made from the watch page holds the old page on screen.
const SWAP_WAIT_MS = 1500

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

// The preview place worked out for each viewport width, so every preview, on the first page and on
// the pages chosen from it, starts in exactly the same spot. By width alone: a phone's address bar
// coming and going changes the height, and must not move the pose.
const shifts = new Map<number, number>()
let swap: ViewTransition | undefined

/**
 * Makes a page change from the watch page (`go`: a row, autoplay) one view transition, marked for
 * watch.css: the text fades out as the stage glides to the preview place. With the stage scrolled
 * out of sight (a phone, down at Up next) it is marked "far": the stage does not fly in from off
 * screen, the page cross-fades to the new preview instead. The old page holds until the new one is
 * in (a new .watch-page, polled by timer: no animation frames run while a transition holds the
 * page), and the mark lasts until the transition ends, however slow the device. False, doing
 * nothing, under reduced motion or without view transitions: the caller just changes the page.
 */
export function swapWatchPage(go: () => void): boolean {
  if (prefersReducedMotion() || !('startViewTransition' in document)) return false
  const root = document.documentElement
  const old = document.querySelector('.watch-page')
  const stage = document.querySelector('.watch-stage-wrap')?.getBoundingClientRect()
  const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
  root.dataset.watchSwap = stage && (stage.bottom <= top || stage.top >= innerHeight) ? 'far' : ''
  const start = performance.now()
  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        go()
        const wait = () => {
          const page = document.querySelector('.watch-page')
          if ((page && page !== old) || performance.now() - start > SWAP_WAIT_MS) resolve()
          else setTimeout(wait, 16)
        }
        wait()
      }),
  )
  swap = transition
  // A transition skipped (another page change, the tab hidden) rejects these: nothing to do.
  transition.ready.catch(() => {})
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (swap !== transition) return
      swap = undefined
      delete root.dataset.watchSwap
    })
  return true
}

const rootPx = (name: string) => {
  const root = getComputedStyle(document.documentElement)
  const value = root.getPropertyValue(name).trim()
  return (parseFloat(value) || 0) * (value.endsWith('rem') ? parseFloat(root.fontSize) : 1)
}

/**
 * While the preview plays the stage sits in the middle of the viewport (watch.css). This measures
 * it and sets --watch-centre (the shift, again on resize) and --watch-wait (the reveal's wait for
 * the glide back) on the watch page. Layout values only (offsetTop), so the shift never measures
 * itself. Read just after commit, once the router has restored the page's scroll.
 */
export function useStageCentre() {
  useLayoutEffect(() => {
    let skip: boolean | undefined
    let first = true
    let live = true
    const measure = () => {
      const page = document.querySelector<HTMLElement>('.watch-page')
      const wrap = page?.querySelector<HTMLElement>('.watch-stage-wrap')
      const stage = wrap?.querySelector<HTMLElement>('.watch-stage')
      if (!live || !page || !wrap || !stage) return
      skip ??= scrollY > 0 || !stage.querySelector('.reel')
      const shift = skip
        ? 0
        : (shifts.get(innerWidth) ??
          centreShift({
            viewport: innerHeight,
            top: rootPx('--header-h'),
            bottom: rootPx('--tabbar-h'),
            stageTop: page.getBoundingClientRect().top + scrollY + wrap.offsetTop,
            stageHeight: stage.offsetHeight,
            skip,
          }))
      if (!skip) shifts.set(innerWidth, shift)
      page.style.setProperty('--watch-centre', `${shift}px`)
      // Kept in step while the preview plays (a phone turned on its side or back: a glide, or none),
      // then never again: a later change would move the reveal's start, replaying a reveal done.
      if (first || stage.querySelector('.reel'))
        page.style.setProperty('--watch-wait', `${shift ? GLIDE_MS : 0}ms`)
      first = false
    }
    queueMicrotask(measure)
    addEventListener('resize', measure)
    return () => {
      live = false
      removeEventListener('resize', measure)
    }
  }, [])
}
