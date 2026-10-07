import { useId, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import VideoGrid from '../components/VideoGrid'
import { GridHint } from '../components/browse-ui'
import { BookmarkIcon } from '../components/icons'
import EmptyState from '../components/ui/EmptyState'
import LinkButton from '../components/ui/LinkButton'
import SectionHeading from '../components/ui/SectionHeading'
import { getLatest, getVideo, hasCleanPoster } from '../data/catalog'
import { myListSeo, useSeo } from '../lib/seo'
import { useMyList } from '../lib/storage'
import '../components/pages.css'

/** Starting picks under an empty list: one line of cards at every width (browse.css). */
const PICKS = 5

export default function MyListPage() {
  useSeo(myListSeo())
  const { ids } = useMyList()
  const saved = useMemo(() => ids.map((id) => getVideo(id)).filter((v) => v !== undefined), [ids])
  // Opened with nothing saved: the newest videos stay below for this visit, so a Save pressed there
  // keeps its place (and focus) while the list above fills in.
  const [starter] = useState(() => saved.length === 0)
  // Unsaving a card here removes it: focus moves to the Save of the card that takes its place (the
  // one before at the end; the empty state's first link when none is left), never to the body.
  const lost = useRef(-1)
  // Said aloud, since the card just goes: focus lands on the next one with no word of the change.
  const [removed, setRemoved] = useState('')
  const onClickCapture = (e: MouseEvent) => {
    const button = (e.target as HTMLElement).closest('button[aria-pressed="true"]')
    const item = button?.closest('li')
    if (item?.parentElement) {
      lost.current = Array.prototype.indexOf.call(item.parentElement.children, item)
      const title = button?.getAttribute('aria-label')?.replace(/^Save /, '')
      setRemoved(title ? `Removed “${title}” from My List` : 'Removed from My List')
    }
  }
  const page = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const at = lost.current
    lost.current = -1
    if (at < 0 || !page.current) return
    const items = page.current.querySelectorAll('.saved-grid [role="list"] > li')
    const next = items[Math.min(at, items.length - 1)]
    const target = next
      ? next.querySelector<HTMLElement>('button[aria-pressed]')
      : page.current.querySelector<HTMLElement>('a[href]')
    target?.focus()
  }, [saved])

  return (
    <div ref={page} className="px-(--gutter) pt-6 pb-16 sm:pt-8">
      <p role="status" className="sr-only">
        {removed}
      </p>
      <SectionHeading
        as="h1"
        eyebrow="Saved for later"
        title="My List"
        description={
          saved.length > 0
            ? `${saved.length} saved ${saved.length === 1 ? 'video' : 'videos'}, newest first. Your list is kept in this browser.`
            : undefined
        }
      />
      {saved.length > 0 ? (
        <>
          <GridHint />
          <div className="saved-grid mt-8" onClickCapture={onClickCapture}>
            <VideoGrid videos={saved} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<BookmarkIcon />}
          title="Nothing saved yet"
          compact={starter}
          className="tv-spot"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <LinkButton to="/collections">Browse collections</LinkButton>
              <LinkButton to="/" variant="secondary">
                Back to Browse
              </LinkButton>
            </div>
          }
        >
          <p>
            Press <strong className="font-semibold text-ink">Save</strong> on any video to keep it
            here. Your list stays in this browser, no account needed.
          </p>
        </EmptyState>
      )}
      {starter && <StarterPicks below={saved.length > 0} />}
    </div>
  )
}

/** The newest videos with a clean image, each with its Save: somewhere to start an empty list. */
function StarterPicks({ below }: { below: boolean }) {
  const headingId = useId()
  const picks = useMemo(() => getLatest(24).filter(hasCleanPoster).slice(0, PICKS), [])
  if (picks.length === 0) return null
  return (
    <section
      aria-labelledby={headingId}
      className={`starter-picks ${below ? 'mt-12 sm:mt-16' : 'mt-4'} tv-hairline border-t border-line pt-8 sm:pt-10`}
    >
      <SectionHeading id={headingId} title="Start with the newest" />
      <div className="mt-5">
        <VideoGrid videos={picks} heading="h3" />
      </div>
    </section>
  )
}
