import { memo, useEffect, useId, useRef, useState, type FocusEvent, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigationType } from 'react-router'
import { lastInput } from '../lib/pointer'
import type { Video } from '../types'
import Backdrop from './Backdrop'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Recommended from './Recommended'
import Thumbnail from './Thumbnail'
import VideoGrid from './VideoGrid'
import { FactsLine, LONG_TITLE } from './browse-ui'
import { AT_DETAILS } from './details'
import { prefersReducedMotion } from './hooks'
import { ChevronDownIcon, InfoIcon, PlayIcon } from './icons'
import { useCardPreview } from './preview'
import SectionHeading from './ui/SectionHeading'
import { PRESSED, buttonClass } from './ui/button-styles'

interface Props {
  videos: readonly Video[]
  /** Newest titles, a row under the Featured row. */
  alsoNew: readonly Video[]
  /** The video the hero opens on (the first by default). */
  start?: number
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

// A round icon button below 640px.
const ICON_ON_PHONE = 'max-sm:w-11 max-sm:px-0'

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
 * restart one in Also new), no dialog open (a hidden tab pauses it). A pointer resting on a card
 * (HOVER_INTENT_MS), or focus on one, shows that video at once; the count then starts from it. The
 * active card shows the count as a thin line.
 */
function FeaturedHome({ videos, alsoNew, start = 0 }: Props) {
  const { key } = useLocation()
  const popped = useNavigationType() === 'POP'
  const count = videos.length
  const [index, setIndex] = useState(() =>
    Math.min(popped ? (heroAt.get(key) ?? start) : start, count - 1),
  )
  useEffect(() => void heroAt.set(key, index), [key, index])
  const shown = useRef(index)
  const zone = useRef<HTMLDivElement>(null)
  const hovered = useRef(false)
  const intent = useRef({ timer: 0, to: -1 })

  useEffect(() => {
    let waited = 0
    const reset = () => (waited = 0)
    window.addEventListener('pointerdown', reset, true)
    window.addEventListener('keydown', reset, true)
    const timer = window.setInterval(() => {
      const el = zone.current
      if (document.hidden || !el) return
      const busy =
        hovered.current ||
        el.contains(document.activeElement) ||
        document.querySelector('.card-preview') ||
        document.querySelector('dialog[open]')
      waited = busy ? 0 : waited + TICK_MS
      // On the active card only: on the zone it restyled the hero and the whole row every tick.
      el.querySelector<HTMLElement>('[data-row="featured"] > li[data-active]')?.style.setProperty(
        '--advance',
        String(waited / ADVANCE_MS),
      )
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
      li.style.removeProperty('--advance')
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
        onPointerOver={(e) => pick(e.target, HOVER_INTENT_MS)}
        onFocus={(e) => pick(e.target, 0)}
      >
        <Hero video={videos[Math.min(index, count - 1)]} priority={index === start} />
        {/* Every featured video, side by side: five in a line from lg, scrolling sideways below. */}
        <section aria-label="Featured videos" className="px-(--gutter) py-6">
          <div className="row">
            <div data-spatial="track" className="row-track">
              <VideoGrid videos={videos} layout="row" row="featured" showCategory />
            </div>
          </div>
        </section>
      </div>
      {alsoNew.length > 0 && (
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
const HERO_CONTROLS = '[data-hero-text] :is(a, button)'
function swapHero(apply: () => void) {
  const before = [...document.querySelectorAll(HERO_CONTROLS)]
  const fromEnd = before.length - before.indexOf(document.activeElement as Element)
  const show = () => {
    flushSync(apply)
    if (fromEnd > before.length) return
    const after = [...document.querySelectorAll<HTMLElement>(HERO_CONTROLS)]
    refocusing = true
    after[Math.max(0, after.length - fromEnd)]?.focus({ preventScroll: true })
    refocusing = false
  }
  if (!document.startViewTransition || prefersReducedMotion() || document.hidden) return show()
  const zone = document.querySelector<HTMLElement & Partial<Pick<Document, 'startViewTransition'>>>(
    '[data-featured-zone]',
  )
  const scoped = zone?.startViewTransition ? zone : undefined
  const root = scoped ?? document.documentElement
  root.dataset.heroSwap = ''
  const transition = scoped?.startViewTransition?.(show) ?? document.startViewTransition(show)
  swapping = transition
  void transition.finished.finally(() => {
    if (swapping === transition) delete root.dataset.heroSwap
  })
}

/**
 * The featured video, large: its picture (previews on hover or keyboard focus) and its details. The
 * picture has no frame; its edges melt into the backdrop (browse.css, .hero-still).
 */
function Hero({ video, priority }: { video: Video; priority: boolean }) {
  const headingId = useId()
  const preview = useCardPreview(video)
  const long = video.title.length > LONG_TITLE
  const onFocus = () => {
    if (lastInput() !== 'pointer' && !refocusing) preview.start()
  }
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) preview.stop()
  }

  return (
    <div data-lead={video.id} className="relative isolate overflow-hidden">
      <Backdrop video={video} scrim={SCRIM} />
      {/* Phones: Featured, the picture, the details. From lg the details sit beside the picture,
          Featured on top of them. */}
      <section
        aria-labelledby={headingId}
        onFocus={onFocus}
        onBlur={onBlur}
        className="grid gap-5 px-(--gutter) pt-6 pb-2 sm:pt-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-4 lg:pt-10"
      >
        <SectionHeading
          id={headingId}
          title="Featured"
          className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:self-end"
        />
        <div
          {...preview.hostProps}
          data-hero-media=""
          className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center"
        >
          {/* Decorative duplicate of the Play button. */}
          <PlayLink video={video} tabIndex={-1} aria-hidden="true" className="hero-still block">
            <Thumbnail
              video={video}
              sizes="(min-width: 64rem) 55vw, 100vw"
              large
              canonical
              loading="eager"
              fetchPriority={priority ? 'high' : undefined}
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
          className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-2 lg:self-start"
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
            {/* One row at every width (Details and Save as icons on phones): ↓ from Play leaves the
              hero instead of stopping on a wrapped Save. Details opens the quick look on the
              video's details (title, facts and citation). */}
            <div className="mt-5 flex items-center gap-3">
              <PlayLink video={video} data-spatial="entry" className={buttonClass('primary')}>
                <PlayIcon />
                Play
              </PlayLink>
              <DetailsLink
                id={video.id}
                hash={AT_DETAILS}
                className={buttonClass('secondary', 'md', ICON_ON_PHONE)}
              >
                <InfoIcon />
                <span className="max-sm:sr-only">Details</span>
              </DetailsLink>
              <MyListButton
                id={video.id}
                title={video.title}
                className={buttonClass('secondary', 'md', `${ICON_ON_PHONE} ${PRESSED}`)}
                labelClassName="max-sm:sr-only"
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
  const pill = useRef<HTMLButtonElement>(null)
  const [covering, setCovering] = useState(false)
  useEffect(() => {
    const check = () => {
      const card = document.activeElement?.closest('article')?.getBoundingClientRect()
      const box = pill.current?.getBoundingClientRect()
      setCovering(!!card && !!box && card.bottom > box.top && card.top < box.bottom)
    }
    document.addEventListener('focusin', check)
    window.addEventListener('scrollend', check)
    return () => {
      document.removeEventListener('focusin', check)
      window.removeEventListener('scrollend', check)
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
      className="more-below pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pt-16 pb-[calc(4.75rem+env(safe-area-inset-bottom))] transition-opacity duration-300 data-hidden:invisible data-hidden:opacity-0 md:pb-6"
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
