import { memo, type SyntheticEvent } from 'react'
import { Link } from 'react-router'
import { GENERAL_CATEGORY, getCategoryVideos, type Category } from '../data/catalog'
import type { Video } from '../types'
import { imagesOf } from './media'
import { MARK, toneOf } from './tones'

// The large tile is two thirds of the card: one, two, three or four cards per row (the content
// stops growing at 1600px, so do the tiles).
const MAIN_SIZES =
  '(min-width: 96rem) min(15vw, 16rem), (min-width: 64rem) 20vw, (min-width: 40rem) 30vw, 62vw'
const SIDE_SIZES =
  '(min-width: 96rem) min(7.5vw, 8rem), (min-width: 64rem) 10vw, (min-width: 40rem) 15vw, 31vw'

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}
// A missing large still falls back to the small one; if that fails too, the well stays.
const retryOrHide = (e: SyntheticEvent<HTMLImageElement>, small: string) => {
  const img = e.currentTarget
  if (img.srcset || img.getAttribute('src') !== small) {
    img.srcset = ''
    img.src = small
  } else img.dataset.failed = ''
}

function Tile({
  video,
  sizes,
  className = '',
}: {
  video: Video
  sizes: string
  className?: string
}) {
  // Canonical stills: a mosaic of three shows any odd rotating frame at once (no image when every
  // one is flagged).
  const images = imagesOf(video, true)
  if (!images) return <div className={`bg-surface-2 ${className}`} />
  const { small, srcSet } = images
  return (
    <div className={`overflow-hidden bg-surface-2 ${className}`}>
      <img
        src={small}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={markLoaded}
        onError={(e) => retryOrHide(e, small)}
        className="size-full object-cover opacity-0 transition-opacity duration-300 data-loaded:opacity-100 data-failed:invisible motion-reduce:transition-none"
      />
    </div>
  )
}

/** 16:9 cover from the newest three stills: a large one and two stacked beside it. */
function Mosaic({ videos }: { videos: readonly Video[] }) {
  const [main, ...rest] = videos
  if (!main) return <div className="aspect-video bg-surface-2" />
  const layout = rest.length >= 2 ? 'grid-cols-3 grid-rows-2' : rest.length ? 'grid-cols-2' : ''
  return (
    <div aria-hidden="true" className={`grid aspect-video gap-0.5 bg-surface ${layout}`}>
      <Tile
        video={main}
        sizes={MAIN_SIZES}
        className={rest.length >= 2 ? 'col-span-2 row-span-2' : ''}
      />
      {rest.slice(0, 2).map((v) => (
        <Tile key={v.id} video={v} sizes={SIDE_SIZES} />
      ))}
    </div>
  )
}

/** A collection: its brand bar, a mosaic of its newest stills, name, count and those titles. */
function CategoryCard({ category }: { category: Category }) {
  const { slug, name, count } = category
  const newest = getCategoryVideos(slug).slice(0, 3)
  return (
    <article className="group/cat relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-[translate,scale,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus motion-safe:has-[a:focus-visible]:scale-102 motion-reduce:transition-none">
      <span aria-hidden="true" className={`h-1.5 shrink-0 ${MARK[toneOf(slug)]}`} />
      <Mosaic videos={newest} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2
          title={name}
          className="line-clamp-2 font-display text-2xl leading-tight text-ink transition-colors group-hover/cat:text-maroon"
        >
          <Link to={`/collections/${slug}`} className="outline-none after:absolute after:inset-0">
            {name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-ink-3">
          {count} {count === 1 ? 'video' : 'videos'}
          {name === GENERAL_CATEGORY && ' · no subject category'}
        </p>
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-ink-2">
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
