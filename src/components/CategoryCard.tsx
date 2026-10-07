import { memo, type SyntheticEvent } from 'react'
import { Link } from 'react-router'
import { GENERAL_CATEGORY, getCategoryVideos, type Category } from '../data/catalog'
import type { Video } from '../types'
import { useNear } from './browse-hooks'
import { ChevronRightIcon } from './icons'
import { cardSrcSet, imagesOf, thumbnailOf, zoomStyle } from './media'
import { MARK, toneOf } from './tones'
import './pages.css'

// Covers below the first row load once they come within a quarter screen of the viewport.
const NEAR = '25% 0px'

// The large tile is two thirds of the card: one, two, three or four cards per row (the content
// stops growing at 1600px, so do the tiles).
const MAIN_SIZES =
  '(min-width: 96rem) min(15vw, 16rem), (min-width: 64rem) 20vw, (min-width: 40rem) 30vw, 62vw'
const SIDE_SIZES =
  '(min-width: 96rem) min(7.5vw, 8rem), (min-width: 64rem) 10vw, (min-width: 40rem) 15vw, 31vw'

// The well stops shimmering (pages.css) once its picture is in or has failed: data-pending is cleared
// on the well itself, which costs far less to match than a :has() on the image.
const settle = (img: HTMLImageElement) => img.parentElement?.removeAttribute('data-pending')
const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
  settle(e.currentTarget)
}
const markFailed = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.failed = ''
  settle(e.currentTarget)
}
// A missing large still falls back to the small one; if that fails too, the well stays.
const retryOrHide = (e: SyntheticEvent<HTMLImageElement>, small: string) => {
  const img = e.currentTarget
  if (img.srcset || img.getAttribute('src') !== small) {
    img.srcset = ''
    img.src = small
  } else {
    img.dataset.failed = ''
    settle(img)
  }
}

function Tile({
  video,
  sizes,
  load,
  className = '',
}: {
  video: Video
  sizes: string
  load: boolean
  className?: string
}) {
  // Canonical stills: a mosaic of three shows any odd rotating frame at once (the least bad image
  // when every image is flagged).
  const { small, srcSet, zoom } = thumbnailOf(video, true)
  if (!load) return <div className={`page-tile bg-surface-2 ${className}`} />
  return (
    // The tile is not 16:9 (the large one is 1.2:1), and a 4:3 still (YouTube's 480 and 640px ones,
    // a denser screen's pick) carries its letterbox bars: there the picture is a centred 16:9 box the
    // height of the tile, so those bars fall outside it as they do in any 16:9 slot.
    <div
      data-pending=""
      className={`page-tile overflow-hidden bg-surface-2 hidpi:flex hidpi:items-center hidpi:justify-center ${className}`}
    >
      <img
        src={small}
        srcSet={cardSrcSet(srcSet)}
        sizes={sizes}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={markLoaded}
        onError={(e) => retryOrHide(e, small)}
        style={zoomStyle(zoom)}
        className="size-full object-cover opacity-0 hidpi:aspect-video hidpi:w-auto hidpi:max-w-none hidpi:shrink-0 transition-opacity duration-300 data-loaded:opacity-100 data-failed:invisible motion-reduce:transition-none"
      />
    </div>
  )
}

/**
 * Up to `count` of a collection's newest videos with a usable image: a cover is made of stills, so
 * a video whose every image is flagged stays out (its least bad image only when no video has one).
 */
function coverVideos(slug: string, count: number): Video[] {
  const list = getCategoryVideos(slug)
  const picked: Video[] = []
  for (const video of list) {
    if (imagesOf(video, true)) picked.push(video)
    if (picked.length === count) break
  }
  return picked.length ? picked : list.slice(0, 1)
}

/** 16:9 cover from the newest three stills: a large one and two stacked beside it. */
function Mosaic({ videos, load }: { videos: readonly Video[]; load: boolean }) {
  const [main, ...rest] = videos
  if (!main) return <div className="aspect-video bg-surface-2" />
  const layout = rest.length >= 2 ? 'grid-cols-3 grid-rows-2' : rest.length ? 'grid-cols-2' : ''
  return (
    <div aria-hidden="true" className={`tv-cover grid aspect-video gap-0.5 bg-surface ${layout}`}>
      <Tile
        video={main}
        sizes={MAIN_SIZES}
        load={load}
        className={rest.length >= 2 ? 'col-span-2 row-span-2' : ''}
      />
      {rest.slice(0, 2).map((v) => (
        <Tile key={v.id} video={v} sizes={SIDE_SIZES} load={load} />
      ))}
    </div>
  )
}

const countOf = ({ name, count }: Category) =>
  `${count} ${count === 1 ? 'video' : 'videos'}${name === GENERAL_CATEGORY ? ' · no subject category' : ''}`

/**
 * A collection: its brand bar, a mosaic of its newest stills, name, count and those titles.
 * `eager` (the first row) loads the stills at once; other cards load them as they come near.
 */
function CategoryCard({ category, eager = true }: { category: Category; eager?: boolean }) {
  const { slug, name } = category
  const newest = getCategoryVideos(slug).slice(0, 3)
  const [ref, near] = useNear<HTMLElement>(eager, NEAR)
  return (
    <article
      ref={ref}
      className="tv-card group/cat relative flex h-full flex-col overflow-hidden rounded-card border border-glass-border bg-surface"
    >
      <span aria-hidden="true" className={`h-1.5 shrink-0 ${MARK[toneOf(slug)]}`} />
      <Mosaic videos={coverVideos(slug, 3)} load={near} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2
          title={name}
          className="line-clamp-2 font-display text-2xl leading-tight text-ink transition-colors group-hover/cat:text-maroon"
        >
          {/* A card's stretched link (data-card-link): the remote reveals the whole card, centred,
              not just this title (it left the count and newest titles below the fold). */}
          <Link
            to={`/collections/${slug}`}
            data-card-link=""
            className="outline-none after:absolute after:inset-0"
          >
            {name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-ink-3">{countOf(category)}</p>
        <ul className="tv-hairline mt-3 space-y-1 border-t border-line pt-3 text-sm text-ink-2">
          {newest.map((v) => (
            <li key={v.id} className="truncate">
              {v.title}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

export default memo(CategoryCard)

/**
 * Phone list row: the collection's brand bar, a small cover, name, count and a chevron; the whole
 * row is the link (64px tall).
 */
export const CategoryListItem = memo(function CategoryListItem({
  category,
  eager,
}: {
  category: Category
  eager: boolean
}) {
  const { slug, name } = category
  const [ref, near] = useNear<HTMLAnchorElement>(eager, NEAR)
  const [cover] = coverVideos(slug, 1)
  const images = cover && thumbnailOf(cover, true)
  return (
    <Link
      ref={ref}
      to={`/collections/${slug}`}
      className="page-row flex min-h-16 items-center gap-3 px-3 py-2.5 transition-colors focus-visible:outline-3 focus-visible:-outline-offset-3"
    >
      <span aria-hidden="true" className={`h-11 w-1 shrink-0 rounded-pill ${MARK[toneOf(slug)]}`} />
      <span
        aria-hidden="true"
        data-pending={images && near ? '' : undefined}
        className="page-row-cover relative aspect-video w-[min(5rem,22vw)] shrink-0 overflow-hidden rounded-md bg-surface-2"
      >
        {images && near && (
          <img
            src={images.small}
            style={zoomStyle(images.zoom)}
            alt=""
            decoding="async"
            onLoad={markLoaded}
            onError={markFailed}
            className="size-full object-cover opacity-0 transition-opacity duration-300 data-loaded:opacity-100 data-failed:invisible motion-reduce:transition-none"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 leading-snug font-semibold text-ink">{name}</span>
        <span className="block truncate text-sm text-ink-3">{countOf(category)}</span>
      </span>
      <ChevronRightIcon className="size-5 shrink-0 text-ink-3" />
    </Link>
  )
})
