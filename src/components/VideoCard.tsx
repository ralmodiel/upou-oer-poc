import { memo, type SyntheticEvent } from 'react'
import { latest } from '../data/catalog'
import type { Video } from '../types'
import DetailsLink from './DetailsLink'
import MyListButton from './MyListButton'
import PlayLink from './PlayLink'
import { ChevronDownIcon, InfoIcon, PlayIcon } from './icons'

const NEW_IDS = new Set(latest.slice(0, 5).map((v) => v.id))

const markLoaded = (e: SyntheticEvent<HTMLImageElement>) => {
  e.currentTarget.dataset.loaded = ''
}

// The hover overlay shows on hover or keyboard focus, and only then takes pointer input.
const SHOWN =
  'opacity-0 transition duration-300 ease-cinematic group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100'
const ACTION =
  'pointer-events-none size-8 group-hover/card:pointer-events-auto group-has-focus-visible/card:pointer-events-auto sm:size-9'
// Touch screens have no hover, so More Info stays visible as a corner button there.
const TOUCH_INFO =
  '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:top-1.5 [@media(hover:none)]:right-1.5 [@media(hover:none)]:bottom-auto [@media(hover:none)]:opacity-100'

interface Props {
  video: Video
  /** `sizes` for the thumbnail, matching the layout the card sits in. */
  sizes: string
  /** Title level, one below the heading of the list the card sits in. */
  heading?: 'h2' | 'h3' | 'h4'
}

function VideoCard({ video, sizes, heading: Heading = 'h3' }: Props) {
  const { id, title } = video
  return (
    <article className="group/card relative flex flex-col-reverse">
      <Heading className="mt-2 line-clamp-2 text-xs leading-snug text-neutral-400 transition-colors duration-200 group-hover/card:text-neutral-100 sm:text-sm">
        {/* Stretched link: a click, tap or Enter anywhere on the card plays the video. */}
        <PlayLink
          video={video}
          aria-label={`Play ${title}`}
          className="outline-none after:absolute after:inset-0 after:z-10"
        >
          {title}
        </PlayLink>
      </Heading>
      <div className="pointer-events-none relative z-20 aspect-video overflow-hidden rounded-md bg-ink-800 ring-brand-400 transition-[scale,box-shadow,z-index] duration-300 ease-cinematic group-hover/card:z-30 group-hover/card:scale-108 group-hover/card:shadow-2xl group-hover/card:shadow-black/70 group-has-focus-visible/card:z-30 group-has-focus-visible/card:scale-108 group-has-focus-visible/card:ring-2 motion-reduce:scale-100!">
        <img
          src={video.thumbnail}
          srcSet={`${video.thumbnail} 320w, ${video.backdrop} 1280w`}
          sizes={sizes}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={markLoaded}
          className="size-full object-cover opacity-0 transition-opacity duration-500 data-loaded:opacity-100"
        />
        {NEW_IDS.has(id) && (
          <span className="absolute top-1.5 left-1.5 rounded-sm bg-brand-600 px-1.5 py-1 text-[0.625rem] leading-none font-bold tracking-wider text-white shadow-md">
            NEW
          </span>
        )}
        <div
          className={`absolute inset-0 flex items-end gap-1.5 bg-linear-to-t from-ink-950/90 via-ink-950/25 to-transparent p-2 ${SHOWN}`}
        >
          {/* Visual cue only: the card link already plays. */}
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-white text-ink-950 sm:size-9"
          >
            <PlayIcon className="size-4" />
          </span>
          <MyListButton id={id} title={title} className={ACTION} />
        </div>
        <DetailsLink
          id={id}
          aria-label={`More info: ${title}`}
          className={`${ACTION} ${SHOWN} ${TOUCH_INFO} absolute right-2 bottom-2 grid place-items-center rounded-full bg-ink-950/60 text-white ring-2 ring-white/50 hover:ring-white`}
        >
          <ChevronDownIcon className="size-4 [@media(hover:none)]:hidden" />
          <InfoIcon className="hidden size-4 [@media(hover:none)]:block" />
        </DetailsLink>
      </div>
    </article>
  )
}

export default memo(VideoCard)
