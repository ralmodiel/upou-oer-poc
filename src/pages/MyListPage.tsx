import { useMemo } from 'react'
import { Link } from 'react-router'
import EmptyState from '../components/EmptyState'
import VideoGrid from '../components/VideoGrid'
import { useDocumentTitle } from '../components/hooks'
import { ListIcon, PlusIcon } from '../components/icons'
import { getVideo } from '../data/catalog'
import { useMyList } from '../lib/storage'

export default function MyListPage() {
  useDocumentTitle('My List · UPOU Networks')
  const { ids } = useMyList()
  const saved = useMemo(() => ids.map((id) => getVideo(id)).filter((v) => v !== undefined), [ids])

  return (
    <div className="px-(--gutter) pt-24 pb-8 sm:pt-28">
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">My List</h1>
      {saved.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-neutral-400">
            {saved.length} saved {saved.length === 1 ? 'title' : 'titles'}
          </p>
          <div className="mt-8">
            <VideoGrid videos={saved} />
          </div>
        </>
      ) : (
        <EmptyState
          icon={<ListIcon className="size-7" />}
          title="Your list is empty"
          action={
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-md bg-white px-6 font-semibold text-ink-950 transition hover:bg-neutral-200"
            >
              Browse videos
            </Link>
          }
        >
          <p>
            Select{' '}
            <PlusIcon className="inline size-4 rounded-full align-[-0.15em] ring-1 ring-current" />{' '}
            on any title to save it here for later.
          </p>
        </EmptyState>
      )}
    </div>
  )
}
