import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { getVideo } from '../data/catalog'
import WatchCite from '../features/watch/WatchCite'
import { useProfile } from '../lib/history'
import { lastInput } from '../lib/pointer'
import { topicTags } from '../lib/tags'
import { watchUrl } from '../lib/youtube'
import type { Video } from '../types'
import Backdrop from './Backdrop'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import Thumbnail from './Thumbnail'
import VideoGrid from './VideoGrid'
import { useFrozen } from './browse-hooks'
import { FactsLine, LONG_TITLE, TEXT_LINK } from './browse-ui'
import { AT_DETAILS, DetailsContext, detailsShortfall, wasOpenedInApp } from './details'
import { prefersReducedMotion, useDocumentTitle } from './hooks'
import { ChevronDownIcon, CloseIcon, ExternalLinkIcon, PlayIcon } from './icons'
import { stopPreview } from './preview'
import { CardReasons, moreLikeThis, reasonsFor } from './recs'
import Chip from './ui/Chip'
import IconButton from './ui/IconButton'
import { PRESSED, buttonClass } from './ui/button-styles'
import './browse.css'
import './pages.css'

// Matches the data-closing transition in browse.css.
const EXIT_MS = 200
const SIMILAR = 6
// The foot of the view the More like this pill floats in (scroll-pb-24).
const PILL_ZONE = 96
// Soft glow of the video's still behind the image column, gone by the time the text starts.
const SCRIM = 'bg-linear-to-b from-surface/40 via-surface/80 via-60% to-surface'

/** Quick look dialog driven by `?v=<id>`; unknown ids render nothing. */
function focusPageTitle() {
  const title = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main')
  if (!title) return
  if (!title.hasAttribute('tabindex')) title.tabIndex = -1
  title.focus({ preventScroll: true })
}

export default function DetailModal() {
  const [params] = useSearchParams()
  const video = getVideo(params.get('v'))
  return video ? <DetailDialog video={video} /> : null
}

function DetailDialog({ video }: { video: Video }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closing = useRef(false)
  const exitTimer = useRef(0)
  const pressedBackdrop = useRef(false)
  const titleId = useId()
  const navigate = useNavigate()
  const { search, hash, state } = useLocation()
  const similarRef = useRef<HTMLElement>(null)
  const similarHeading = useRef<HTMLHeadingElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const citeRef = useRef<HTMLDivElement>(null)

  const base = useMemo(() => {
    const params = new URLSearchParams(search)
    params.delete('v')
    return params.toString()
  }, [search])
  // Similar titles swap in place, so Back and close still land on the page underneath.
  const target = useMemo(() => ({ base, replace: true, state }), [base, state])
  // The taste profile as of this title: saving a card below must not reshuffle the grid.
  const profile = useFrozen(useProfile(), video.id)
  const similar = useMemo(() => moreLikeThis(video, { profile, limit: SIMILAR }), [video, profile])
  // Why each one is here, in place of the collection eyebrow.
  const reasons = useMemo(() => reasonsFor(similar, profile, video), [similar, profile, video])
  const tags = useMemo(() => topicTags(video.tags), [video])

  useLayoutEffect(() => {
    const el = dialog.current
    if (!el) return
    closing.current = false
    if (!el.open) el.showModal()
    // Runs before the node is removed (close button, Back, links): a native close
    // returns focus to the element that opened the dialog. Its `close` event arrives later,
    // possibly after a StrictMode remount reopened the dialog; onClose ignores it then.
    return () => {
      closing.current = true
      clearTimeout(exitTimer.current)
      el.close()
    }
  }, [])

  // Each title (the first and any similar one swapped in) opens at the top of the panel, on its
  // still, grown: Enter plays at once, ↓ reaches Play (over-entry), and OK never lands on Close by
  // surprise. Opened from the home hero's Details (#details), focus starts on the details instead,
  // still at the top: the dialog scrolls only when the title is off screen once the citation above
  // it (phones) is in, and then just far enough to show the title and its facts line, clear of the
  // More like this pill. Before paint, so a title swapped in never shows at the old scroll position.
  useLayoutEffect(() => {
    stopPreview()
    const el = dialog.current
    el?.scrollTo({ top: 0 })
    const details = hash === AT_DETAILS ? detailsRef.current : null
    if (!el || !details) {
      el?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
      return
    }
    details.focus({ preventScroll: true })
    const cite = citeRef.current
    if (!cite) return
    // The citation renders on its own once cites.json is in (the first open of a visit): measure
    // once it has a height, not when its data resolves (it may not have rendered yet).
    const observer = new ResizeObserver(() => {
      if (!cite.offsetHeight) return
      observer.disconnect()
      const view = el.getBoundingClientRect()
      const pillZone = (similarHeading.current?.getBoundingClientRect().top ?? 0) > view.bottom
      el.scrollBy({ top: detailsShortfall(el, details, pillZone ? PILL_ZONE : 16) })
    })
    observer.observe(cite)
    return () => observer.disconnect()
  }, [video, hash])

  // The floating More like this pill: shown while its heading is below the dialog's view (long
  // details push it down), gone once the heading is in view or scrolled past.
  const hasSimilar = similar.length > 0
  const [similarBelow, setSimilarBelow] = useState(false)
  useEffect(() => {
    const heading = similarHeading.current
    const root = dialog.current
    if (!heading || !root) return
    const observer = new IntersectionObserver(
      ([entry]) =>
        setSimilarBelow(
          !entry.isIntersecting && entry.boundingClientRect.top > (entry.rootBounds?.top ?? 0),
        ),
      { root },
    )
    observer.observe(heading)
    // A jump (End or Home without smooth scrolling) can carry the heading across the view without
    // it ever intersecting; the whole section, the panel's foot, still reports such a jump.
    const jumps = new IntersectionObserver(
      ([{ isIntersecting, boundingClientRect, rootBounds }]) => {
        const top = rootBounds?.top ?? 0
        if (!isIntersecting && boundingClientRect.top > top) setSimilarBelow(true)
        else if (boundingClientRect.top < top) setSimilarBelow(false)
      },
      { root },
    )
    if (similarRef.current) jumps.observe(similarRef.current)
    return () => {
      observer.disconnect()
      jumps.disconnect()
    }
  }, [hasSimilar])
  const showPill = hasSimilar && similarBelow
  // Phones: How to cite spans the panel, so the pill steps aside while the citation is in the
  // bottom band it floats in (from md it sits beside the citation, never over it).
  const [citeLow, setCiteLow] = useState(false)
  useEffect(() => {
    const cite = citeRef.current
    const root = dialog.current
    if (!cite || !root) return
    const observer = new IntersectionObserver(([entry]) => setCiteLow(entry.isIntersecting), {
      root,
      rootMargin: '-90% 0px 0px 0px',
    })
    observer.observe(cite)
    return () => observer.disconnect()
  }, [])

  // Scrolls More like this to the top of the view; from a keyboard or remote, onto its first card.
  const toSimilar = (e: MouseEvent<HTMLButtonElement>) => {
    const section = similarRef.current
    if (!section) return
    section.scrollIntoView?.({
      block: 'start',
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    })
    // The pill goes once the row is in view: its focus moves on, never out to the page.
    if (e.detail === 0 || lastInput() === 'keyboard')
      section.querySelector<HTMLElement>('[data-card-link]')?.focus({ preventScroll: true })
    else dialog.current?.focus({ preventScroll: true })
  }

  useDocumentTitle(`${video.title} · UPOU OER`)

  // Close natively first (focus returns to the trigger), so we never navigate with it open.
  const leave = () => {
    const el = dialog.current
    el?.close()
    // Opened from a shared link there is no trigger to return focus to (it stays on the closed
    // dialog's button, or the body): start on the page title.
    const active = document.activeElement
    if (!active || active === document.body || el?.contains(active)) focusPageTitle()
    if (wasOpenedInApp(state)) navigate(-1)
    else navigate({ search: base }, { replace: true, preventScrollReset: true })
  }

  const close = () => {
    if (closing.current) return
    closing.current = true
    const el = dialog.current
    if (!el?.open || prefersReducedMotion()) {
      leave()
      return
    }
    el.dataset.closing = ''
    exitTimer.current = window.setTimeout(leave, EXIT_MS)
  }

  const sourceUrl = /^https?:\/\//.test(video.sourceUrl) ? video.sourceUrl : undefined
  const long = video.title.length > LONG_TITLE

  // Tab wraps inside the dialog, so focus never lands on the dialog element or the page.
  const trapTab = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab') return
    const stops = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button, input, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.tabIndex >= 0 && !el.closest('[inert], [hidden]'))
    if (!stops.length) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    const target = e.target as HTMLElement
    if (!e.shiftKey && (target === last || target === e.currentTarget)) {
      e.preventDefault()
      first.focus()
    } else if (e.shiftKey && (target === first || target === e.currentTarget)) {
      e.preventDefault()
      last.focus()
    }
  }

  return (
    <dialog
      ref={dialog}
      data-details=""
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={trapTab}
      onCancel={(e) => {
        // Escape: run the exit animation instead of closing at once.
        e.preventDefault()
        close()
      }}
      onClose={() => {
        // Stale event from an earlier close while the dialog is open again: ignore it.
        if (!dialog.current?.open) close()
      }}
      onPointerDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) close()
      }}
      // While the pill shows, focus and anchor scrolls stop short of it.
      className={`fixed inset-0 m-0 size-full max-h-none max-w-none overflow-y-auto overscroll-contain border-0 bg-transparent p-0 text-ink outline-none backdrop:bg-overlay md:py-10 ${showPill ? 'scroll-pb-24' : 'scroll-pb-4'}`}
    >
      <div className="relative isolate mx-auto min-h-full w-full overflow-hidden bg-surface md:min-h-0 md:w-[min(64rem,calc(100%-3rem))] ql-panel md:rounded-card md:border md:border-line md:shadow-(--shadow-lift) motion-safe:transition-[opacity,scale,translate] motion-safe:duration-250 motion-safe:ease-out-soft motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0 md:motion-safe:starting:translate-y-0 md:motion-safe:starting:scale-[0.98]">
        <Backdrop video={video} scrim={SCRIM} className="bottom-auto h-80 md:h-96" />
        <IconButton
          label="Close"
          icon={<CloseIcon />}
          variant="secondary"
          onClick={close}
          className="absolute top-3 right-3 z-10 md:top-4 md:right-4"
        />

        {/* From md the picture column (picture, Play / Save, How to cite, links) sits beside the
            details; wider than them from lg, so the picture is large. */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 md:grid-cols-12 md:grid-rows-[auto_auto_auto_1fr] md:gap-y-7 md:p-8 lg:gap-x-10">
          {/* The still plays too, and grows while focused or hovered (TV style) into the gutters
              around it, so nothing else moves. The wrapper scales: a focused link drops its
              transition (index.css). Phones: full bleed, no growth. */}
          <div className="-mx-5 -mt-5 min-w-0 md:col-span-6 md:col-start-1 md:row-start-1 md:m-0 md:motion-safe:transition-[scale] md:motion-safe:duration-300 md:motion-safe:ease-out-soft md:motion-safe:hover:scale-108 md:motion-safe:has-[a:focus]:scale-108 lg:col-span-7">
            <PlayLink
              video={video}
              aria-label={`Play ${video.title}`}
              data-autofocus=""
              data-spatial="over-entry"
              className="relative block max-md:focus-visible:outline-none max-md:focus-visible:after:absolute max-md:focus-visible:after:inset-0 max-md:focus-visible:after:shadow-[inset_0_0_0_3px_var(--color-focus)] md:rounded-card"
            >
              <Thumbnail
                video={video}
                sizes="(min-width: 64rem) 545px, (min-width: 48rem) 440px, 100vw"
                large
                canonical
                loading="eager"
                className="ql-still"
              />
            </PlayLink>
          </div>

          <div className="flex flex-wrap items-center gap-3 md:col-span-6 md:col-start-1 md:row-start-2 lg:col-span-7">
            <PlayLink video={video} data-spatial="entry" className={buttonClass('primary')}>
              <PlayIcon />
              Play
            </PlayLink>
            <MyListButton
              id={video.id}
              title={video.title}
              className={buttonClass('secondary', 'md', PRESSED)}
            />
          </div>

          {/* How to cite, right below the picture and its buttons: always whole, never folded. */}
          <div
            ref={citeRef}
            className="min-w-0 md:col-span-6 md:col-start-1 md:row-start-3 md:self-start lg:col-span-7"
          >
            <WatchCite video={video} as="h3" className="ql-cite" />
          </div>

          <div
            ref={detailsRef}
            role="group"
            aria-labelledby={titleId}
            tabIndex={-1}
            // Focused (#details), ↓ steps into the details rather than across to the picture.
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget || e.key !== 'ArrowDown') return
              const first = e.currentTarget.querySelector<HTMLElement>('a[href], button')
              if (!first) return
              e.preventDefault()
              first.focus()
            }}
            className="min-w-0 rounded-card outline-offset-8 focus-visible:shadow-glow md:col-span-6 md:col-start-7 md:row-span-4 md:row-start-1 md:pr-8 lg:col-span-5 lg:col-start-8"
          >
            <h2
              id={titleId}
              className={`ql-title font-display leading-tight text-balance text-ink ${
                long ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              {video.title}
            </h2>
            <FactsLine video={video} className="mt-3" />
            {video.description && (
              <p className="mt-4 text-base leading-relaxed whitespace-pre-line text-ink-2">
                {video.description}
              </p>
            )}
            {tags.length > 0 && (
              <ul
                role="list"
                aria-label="Topics"
                data-spatial="group"
                className="mt-5 flex flex-wrap gap-2"
              >
                {tags.map((tag) => (
                  <li key={tag}>
                    <Chip
                      to={`/search?q=${encodeURIComponent(tag)}`}
                      active={false}
                      title={tag}
                      size="sm"
                    >
                      {tag}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm md:col-span-6 md:col-start-1 md:row-start-4 md:self-start lg:col-span-7">
            <ExternalLink href={watchUrl(video.youtubeId)}>Watch on YouTube</ExternalLink>
            {sourceUrl && <ExternalLink href={sourceUrl}>View on oer.upou.edu.ph</ExternalLink>}
          </div>
        </div>

        {similar.length > 0 && (
          <section
            ref={similarRef}
            aria-labelledby={`${titleId}-similar`}
            className="ql-more border-t border-line p-5 md:px-8 md:py-7"
          >
            <span aria-hidden="true" className="mb-3 block h-1 w-10 rounded-pill bg-band-gold" />
            <h3
              ref={similarHeading}
              id={`${titleId}-similar`}
              className="font-display text-xl text-ink sm:text-2xl"
            >
              More like this
            </h3>
            <div className="mt-4">
              <DetailsContext value={target}>
                <CardReasons value={reasons}>
                  <VideoGrid videos={similar} layout="compact" />
                </CardReasons>
              </DetailsContext>
            </div>
          </section>
        )}
      </div>

      {/* At the foot of the view, above the content, in the glass of the home's "More video
          resources below". Fixed, not sticky: focusing it must not scroll the dialog (that would
          bring the row into view and take the pill, and its focus, away). From md it sits on the
          panel's own grid, centred under the details column, so it never covers How to cite. */}
      {showPill && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex justify-center md:grid md:w-[min(64rem,calc(100%-3rem))] md:grid-cols-12 md:gap-x-8 md:px-8 lg:gap-x-10">
            <button
              type="button"
              onClick={toSimilar}
              className={`browse-glass pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-pill border px-4 py-2 text-sm font-semibold text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus motion-safe:transition-[opacity,background-color] motion-safe:duration-300 motion-safe:starting:opacity-0 md:col-span-6 md:col-start-7 md:mr-8 md:justify-self-center lg:col-span-5 lg:col-start-8 ${citeLow ? 'max-md:not-focus:invisible max-md:not-focus:opacity-0' : ''}`}
            >
              More like this
              <ChevronDownIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative inline-flex min-h-10 items-center gap-1.5 ${TEXT_LINK}`}
    >
      {children}
      <ExternalLinkIcon className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}
