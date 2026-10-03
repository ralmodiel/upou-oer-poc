import { useMemo } from 'react'
import VideoGrid from '../components/VideoGrid'
import { GridHint } from '../components/browse-ui'
import { useDocumentTitle } from '../components/hooks'
import { BookmarkIcon } from '../components/icons-browse'
import EmptyState from '../components/ui/EmptyState'
import LinkButton from '../components/ui/LinkButton'
import SectionHeading from '../components/ui/SectionHeading'
import { getVideo } from '../data/catalog'
import { useMyList } from '../lib/storage'

export default function MyListPage() {
  useDocumentTitle('My List · UPOU Networks')
  const { ids } = useMyList()
  const saved = useMemo(() => ids.map((id) => getVideo(id)).filter((v) => v !== undefined), [ids])

  return (
    <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
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
          <div className="mt-8">
            <VideoGrid videos={saved} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<BookmarkIcon />}
          title="Nothing saved yet"
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
    </div>
  )
}
