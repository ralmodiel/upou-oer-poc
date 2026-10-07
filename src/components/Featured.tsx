import { memo, useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigationType } from 'react-router'
import { getVideo } from '../data/catalog'
import { lastInput } from '../lib/pointer'
import { useSavedPosition } from '../lib/storage'
import type { Video } from '../types'
import Backdrop from './Backdrop'
import Carousel from './Carousel'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayFromStart from './PlayFromStart'
import PlayLink from './PlayLink'
import Recommended from './Recommended'
import Thumbnail from './Thumbnail'
import VideoGrid from './VideoGrid'
import { useBelowFoldLater, useImagesSettled } from './browse-hooks'
import { useCarousel } from './carousel-state'
import { FactsLine, LONG_TITLE } from './browse-ui'
import { AT_DETAILS, wasOpenedInApp } from './details'
import { LAND, prefersReducedMotion } from './hooks'
import { ChevronDownIcon, InfoIcon, PlayIcon } from './icons'
import { HERO_SIZES } from './media'
import { useCardPreview } from './preview'
import SectionHeading from './ui/SectionHeading'
import { PRESSED, buttonClass } from './ui/button-styles'

interface Props {
  videos: readonly Video[]
  /** Newest titles, a row under the Featured row. */
  alsoNew: readonly Video[]
  /** The video the hero opens on (the first by default). */
  start?: number
  /** Also new may render after the first paint when it starts below the fold (a first visit). */
  later?: boolean
}

/** Time the page is left alone before the hero moves on to the next featured video. */
export const ADVANCE_MS = 7000
/** A pointer rests this long on a featured card before the hero shows it (no flicker when sweeping). */
export const HOVER_INTENT_MS = 150
const TICK_MS = 250
// The hero's video on each page of this visit, by location key: Back returns to the one left from
// (its Play keeps focus on the same video, and a restored card needs no swap).
const heroAt = new Map<string, number>()

// Fades the blurred still into the page, fully by the bottom edge (browse.css).
const SCRIM = 'hero-scrim'

// A round icon button below 640px, and in a row under 22rem (Play, Details and Saved labelled take
// about 21.5rem): beside the picture on a phone on its side, from 640px wide, the row has 17-26rem.
const ICON_ON_PHONE = 'max-sm:w-11 max-sm:px-0 @max-[22rem]:w-11 @max-[22rem]:px-0'
const LABEL_ON_PHONE = 'max-sm:sr-only @max-[22rem]:sr-only'
// With Play from start the actions take about 33rem labelled, and beside the picture (lg) the row
// has 23-40rem: its label goes below 34rem of row, and Details' too below 26rem.
const START_ICON = `${ICON_ON_PHONE} @max-[34rem]:w-11 @max-[34rem]:px-0`
const START_LABEL = `${LABEL_ON_PHONE} @max-[34rem]:sr-only`
const DETAILS_ICON_CROWDED = `${ICON_ON_PHONE} @max-[26rem]:w-11 @max-[26rem]:px-0`
const DETAILS_LABEL_CROWDED = `${LABEL_ON_PHONE} @max-[26rem]:sr-only`

/**
 * The top of the home page: a large hero of one featured video, then every featured video as the
 * first row of cards (the hero's video marked), then Also new as a row.
 */
function Featured(props: Props) {
  return props.videos.length ? <FeaturedHome {...props} /> : null
}

/**
 * The hero moves on to the next featured video after ADVANCE_MS left alone: no click or key press,
 * no pointer over the hero or the row, no focus in them, no preview playing anywhere (a swap would
 * restart one in Also new), no dialog open, the hero on screen and no reduced motion (a hidden tab
 * pauses it too). A pointer resting on a card
 * (HOVER_INTENT_MS), or focus on one, shows that video at once; the count then starts from it. The
 * active card shows the count as a thin line.
 */
function FeaturedHome({ videos, alsoNew, start = 0, later = false }: Props) {
  const { key } = useLocation()
  const popped = useNavigationType() === 'POP'
  const count = videos.length
  const [index, setIndex] = useState(() =>
    Math.min(popped ? (heroAt.get(key) ?? start) : start, count - 1),
  )
  useEffect(() => void heroAt.set(key, index), [key, index])
  const shown = useRef(index)
  const zone = useRef<HTMLDivElement>(null)
  // Also new follows the featured zone.
  const showNew = useBelowFoldLater(zone, later, 'bottom')
  const hovered = useRef(false)
  const carousel = useCarousel(videos.length, true)
  const intent = useRef({ timer: 0, to: -1 })

  useEffect(() => {
    let waited = 0
    // A click or key press starts the count again; the line restarts with it on the next tick (it
    // may then end a tick after the swap, unseen).
    let restart = false
    const reset = () => {
      waited = 0
      restart = true
    }
    window.addEventListener('pointerdown', reset, true)
    window.addEventListener('keydown', reset, true)
    const timer = window.setInterval(() => {
      const el = zone.current
      if (document.hidden || !el) return
      const box = el.getBoundingClientRect()
      // Reduced motion: the hero holds still. Scrolled out of view: nobody is watching it move.
      const busy =
        prefersReducedMotion() ||
        box.bottom < 0 ||
        box.top > window.innerHeight ||
        hovered.current ||
        el.contains(document.activeElement) ||
        document.querySelector('.card-preview') ||
        document.querySelector('dialog[open]')
      waited = busy ? 0 : waited + TICK_MS
      const hold = !!busy || restart
      restart = false
      // The progress line is one CSS animation (browse.css) on the active card, held by an
      // attribute written only when that changes: a value written every tick restyled the page.
      const li = el.querySelector<HTMLElement>('[data-row="featured"] > li[data-active]')
      if (li && li.hasAttribute('data-hold') !== hold) li.toggleAttribute('data-hold', hold)
      if (waited < ADVANCE_MS) return
      waited = 0
      swapHero(() => setIndex((i) => (i + 1) % count))
    }, TICK_MS)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pointerdown', reset, true)
      window.removeEventListener('keydown', reset, true)
    }
  }, [count])

  // The active card is marked (browse.css) and, moved on to while the row is not in use, scrolled
  // into the row's view. ponytail: marked through the DOM, as the row (VideoGrid) knows no
  // "active"; a prop on VideoGrid if another row ever needs one.
  useEffect(() => {
    shown.current = index
    const el = zone.current
    const items = el?.querySelectorAll<HTMLElement>('[data-row="featured"] > li') ?? []
    items.forEach((li, i) => {
      li.toggleAttribute('data-active', i === index)
      li.removeAttribute('data-hold')
    })
    const li = items[index]
    const track = li?.closest<HTMLElement>('[data-spatial="track"]')
    if (!li || !track || hovered.current || el?.contains(document.activeElement)) return
    const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0
    const box = track.getBoundingClientRect()
    const card = li.getBoundingClientRect()
    if (card.left >= box.left + pad - 1 && card.right <= box.right - pad + 1) return
    track.scrollTo({
      left: li.offsetLeft - pad,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
  }, [index])

  // A card under the pointer (after the intent delay) or in focus becomes the hero's video.
  const pick = (target: EventTarget, delay: number) => {
    const li = (target as Element).closest('[data-row="featured"] > li')
    const to = li ? Array.prototype.indexOf.call(li.parentElement?.children ?? [], li) : -1
    if (to < 0 || to === intent.current.to) return
    clearTimeout(intent.current.timer)
    intent.current = {
      to,
      timer: window.setTimeout(() => {
        intent.current.to = -1
        if (to !== shown.current) swapHero(() => setIndex(to))
      }, delay),
    }
  }
  const cancelPick = () => {
    clearTimeout(intent.current.timer)
    intent.current.to = -1
  }
  useEffect(() => () => clearTimeout(intent.current.timer), [])

  return (
    <div data-featured-block="">
      <div
        ref={zone}
        data-featured-zone=""
        data-reveal-whole=""
        onPointerEnter={() => (hovered.current = true)}
        onPointerLeave={() => {
          hovered.current = false
          cancelPick()
        }}
        // A mouse resting on a card shows it; a finger is only passing (a scroll or a swipe).
        onPointerOver={(e) => e.pointerType === 'mouse' && pick(e.target, HOVER_INTENT_MS)}
        onFocus={(e) => pick(e.target, 0)}
      >
        <Hero video={videos[Math.min(index, count - 1)]} priority={index === start} />
        {/* Every featured video, side by side: five in a line from lg, scrolling sideways below. */}
        <section aria-label="Featured videos" className="px-(--gutter) py-6">
          {/* Pages like the other rows (its buttons) where it scrolls sideways. */}
          <Carousel carousel={carousel} label="Featured videos">
            <VideoGrid videos={videos} layout="row" row="featured" showCategory />
          </Carousel>
        </section>
      </div>
      {showNew && alsoNew.length > 0 && (
        <Recommended row="new" title="Also new" videos={alsoNew} cards={alsoNew.length} />
      )}
      <MoreBelow />
    </div>
  )
}

/**
 * Shows the hero's next video: the picture and the text cross-fade (browse.css, [data-hero-swap])
 * where View Transitions run and motion is welcome; elsewhere at once. Scoped to the featured zone
 * where the browser can: a document-wide transition restyled the whole page twice per swap (about
 * 1,600 elements, 20-30 ms each, Chrome 154). The text is a new copy per video (Hero), so a
 * control in focus there (a pointer resting on a card while Play holds focus) takes focus again in
 * the new copy: the same button, counted from the end.
 */
let swapping: ViewTransition | null = null
let refocusing = false
const HERO_CONTROLS = '[data-hero-text] a, [data-hero-text] button' // no :is(), Chromium < 88 throws
function swapHero(apply: () => void) {
  const before = [...document.querySelectorAll(HERO_CONTROLS)]
  const fromEnd = before.length - before.indexOf(document.activeElement as Element)
  const show = () => {
    flushSync(apply)
    if (fromEnd > before.length) return
    const after = [...document.querySelectorAll<HTMLElement>(HERO_CONTROLS)]
    refocusing = true
    // Play stays Play: Play from start comes and goes with each video's saved place.
    const to = fromEnd === before.length ? 0 : Math.max(0, after.length - fromEnd)
    after[to]?.focus({ preventScroll: true })
    refocusing = false
  }
  if (!document.startViewTransition || prefersReducedMotion() || document.hidden) return show()
  const zone = document.querySelector<HTMLElement & Partial<Pick<Document, 'startViewTransition'>>>(
    '[data-featured-zone]',
  )
  const scoped = zone?.startViewTransition ? zone : undefined
  // The document-wide transition (no scoped one: Chromium before 140-ish, Safari) paints the hero's
  // snapshots above everything, the sticky header and tab bar too: it cuts instead unless the hero
  // is clear of them.
  if (!scoped && !clearOfChrome(zone)) return show()
  const root = scoped ?? document.documentElement
  root.dataset.heroSwap = ''
  const transition = scoped?.startViewTransition?.(show) ?? document.startViewTransition(show)
  swapping = transition
  void transition.finished.finally(() => {
    if (swapping === transition) delete root.dataset.heroSwap
  })
}

// Whether the parts the swap animates (browse.css, hero-media and hero-text) lie between the
// header and the tab bar.
function clearOfChrome(zone: Element | null): boolean {
  const parts = [...(zone?.querySelectorAll('[data-hero-media], [data-hero-text]') ?? [])]
  if (!parts.length) return false
  const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0
  const tabs = document.querySelector('nav[aria-label="Primary"]')?.getBoundingClientRect()
  const floor = tabs && tabs.height > 0 ? tabs.top : window.innerHeight
  return parts.every((el) => {
    const box = el.getBoundingClientRect()
    return box.top >= header && box.bottom <= floor
  })
}

/**
 * The featured video, large: its picture (previews on hover or keyboard focus) and its details. The
 * picture has no frame; its edges melt into the backdrop (browse.css, .hero-still).
 */
function Hero({ video, priority }: { video: Video; priority: boolean }) {
  const headingId = useId()
  const preview = useCardPreview(video)
  const resumable = useSavedPosition(video.id) !== undefined
  const long = video.title.length > LONG_TITLE
  // A quick look opened from a link paints first: the hero's still, the page's largest download,
  // waits behind it until the pictures on screen have arrived (closing it releases the still).
  // Not when the page shell already started that download (its hero preload, public/theme-boot.js):
  // the file is in, or on its way, so holding it back only delays the paint.
  const { search, state } = useLocation()
  const settled = useImagesSettled()
  const hold =
    !settled &&
    !!getVideo(new URLSearchParams(search).get('v')) &&
    !wasOpenedInApp(state) &&
    !document.querySelector('link[data-hero]')
  const onFocus = () => {
    if (lastInput() !== 'pointer' && !refocusing) preview.start()
  }
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) preview.stop()
  }

  return (
    <div data-lead={video.id} className="relative isolate overflow-hidden">
      {!hold && <Backdrop video={video} scrim={SCRIM} sizes={HERO_SIZES} />}
      {/* Phones: Featured, the picture, the details. From lg, and on a phone on its side (land:),
          the details sit beside the picture, Featured on top of them. */}
      <section
        aria-labelledby={headingId}
        onFocus={onFocus}
        onBlur={onBlur}
        className="grid gap-5 px-(--gutter) pt-6 pb-2 sm:pt-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-4 lg:pt-10 land:grid-cols-12 land:gap-x-6 land:gap-y-2 land:pt-4"
      >
        <SectionHeading
          id={headingId}
          title="Featured"
          className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-end land:col-span-6 land:col-start-7 land:row-start-1 land:self-end"
        />
        <div
          {...preview.hostProps}
          data-hero-media=""
          className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center land:col-span-6 land:col-start-1 land:row-span-2 land:row-start-1 land:self-center"
        >
          {/* Decorative duplicate of the Play button. */}
          <PlayLink video={video} tabIndex={-1} aria-hidden="true" className="hero-still block">
            <Thumbnail
              video={video}
              sizes={HERO_SIZES}
              large
              canonical
              loading="eager"
              fetchPriority={priority ? 'high' : undefined}
              hold={hold}
            >
              {preview.overlay}
            </Thumbnail>
          </PlayLink>
        </div>
        {/* A new copy per video: text that changes in place would shift (CLS). The copy goes inside
            a lasting [data-hero-text]: a scoped View Transition (swapHero) is skipped when a named
            element itself is replaced (Chrome 154, "Prepaint layout check failed"). */}
        <div
          data-hero-text=""
          className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:self-start land:col-span-6 land:col-start-7 land:row-start-2 land:self-start"
        >
          <div key={video.id}>
            <p className="eyebrow truncate tracking-[0.14em]">{video.category}</p>
            <h3
              title={video.title}
              className={`mt-2 min-h-[2lh] font-display text-balance text-ink ${
                long ? 'line-clamp-3 text-2xl sm:text-3xl' : 'line-clamp-3 text-title'
              }`}
            >
              {video.title}
            </h3>
            <FactsLine video={video} className="hero-facts mt-3" passOver />
            <p className="mt-3 line-clamp-3 min-h-[3lh] max-w-2xl text-base text-pretty text-ink-2">
              {video.description}
            </p>
            {/* One row at every width (Play from start, Details and Save as icons on phones): ↓ from
              Play leaves the hero instead of stopping on a wrapped Save. Play from start shows
              while Play would resume a saved place. Details opens the quick look on the video's
              details (title, facts and citation). */}
            <div className="mt-5 flex items-center gap-3 @container">
              <PlayLink video={video} data-spatial="entry" className={buttonClass('primary')}>
                <PlayIcon />
                Play
              </PlayLink>
              <PlayFromStart video={video} className={START_ICON} labelClassName={START_LABEL} />
              <DetailsLink
                id={video.id}
                hash={AT_DETAILS}
                className={buttonClass(
                  'secondary',
                  'md',
                  resumable ? DETAILS_ICON_CROWDED : ICON_ON_PHONE,
                )}
              >
                <InfoIcon />
                <span className={resumable ? DETAILS_LABEL_CROWDED : LABEL_ON_PHONE}>Details</span>
              </DetailsLink>
              <MyListButton
                id={video.id}
                title={video.title}
                className={buttonClass('secondary', 'md', `${ICON_ON_PHONE} ${PRESSED}`)}
                labelClassName={LABEL_ON_PHONE}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * A quiet "More video resources below" over a soft fade at the foot of the screen, from the start
 * until the page footer comes into view (and again once it leaves). Each press glides the next
 * row of videos below the one at the top up to the top (from a keyboard, its first card takes
 * focus). It steps aside while it would cover the card in focus. The remote's arrows pass over it
 * (data-spatial="skip"); the fade never takes a click.
 */
function MoreBelow() {
  const [atFooter, setAtFooter] = useState(false)
  useEffect(() => {
    const footer = document.querySelector('footer, [role="contentinfo"]')
    if (!footer) return
    const observer = new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])
  // Out of the way of a card in focus that it would cover (a remote's reveal can leave one there).
  // On a phone on its side (a short screen) also of the hero's Play, Details and Save, which the
  // pill would otherwise sit on at some scroll positions.
  const pill = useRef<HTMLButtonElement>(null)
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    const over = (a: DOMRect, b: DOMRect) =>
      a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right
    const check = () => {
      const card = document.activeElement?.closest('article')?.getBoundingClientRect()
      const box = pill.current?.getBoundingClientRect()
      const land = matchMedia(LAND).matches
      setCovering(
        !!box &&
          ((!!card && card.bottom > box.top && card.top < box.bottom) ||
            (land &&
              [...document.querySelectorAll(HERO_CONTROLS)].some((e) =>
                over(e.getBoundingClientRect(), box),
              ))),
      )
    }
    check()
    document.addEventListener('focusin', check)
    window.addEventListener('scrollend', check)
    window.addEventListener('resize', check)
    return () => {
      document.removeEventListener('focusin', check)
      window.removeEventListener('scrollend', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // The resting place of a row: just below the sticky header (html scroll-padding-top).
    const rest = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    const next = [...document.querySelectorAll<HTMLElement>('main section')].find(
      (s) =>
        (s.matches('.lazy-section') || s.querySelector('[data-row]')) &&
        s.getBoundingClientRect().top > rest + 8,
    )
    if (!next) return
    const reduced = prefersReducedMotion()
    next.scrollIntoView?.({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
    if (e.detail !== 0) return
    const focusFirst = () =>
      next.querySelector<HTMLElement>('[data-card-link]')?.focus({ preventScroll: true })
    if (reduced) focusFirst()
    else window.addEventListener('scrollend', focusFirst, { once: true })
  }

  return (
    <div
      data-more-below=""
      data-hidden={atFooter || covering ? '' : undefined}
      className="more-below pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pt-16 pb-[calc(4.75rem+env(safe-area-inset-bottom))] transition-opacity duration-300 data-hidden:invisible data-hidden:opacity-0 md:pb-6 land:pb-[calc(var(--tabbar-h)+0.5rem+env(safe-area-inset-bottom))]"
    >
      <button
        ref={pill}
        type="button"
        data-spatial="skip"
        onClick={onClick}
        className="more-below-pill browse-glass pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-pill border px-4 py-2 text-sm max-md:min-h-10 font-semibold text-ink transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        More video resources below
        <ChevronDownIcon className="size-4" />
      </button>
    </div>
  )
}

export default memo(Featured)
