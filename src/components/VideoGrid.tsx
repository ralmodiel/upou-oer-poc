import type { Video } from '../types'
import VideoCard from './VideoCard'

const LAYOUTS = {
  // Page grids sit right under the page h1; compact grids under the modal's h3.
  page: {
    list: 'grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    sizes:
      '(min-width: 96rem) 15vw, (min-width: 80rem) 18vw, (min-width: 64rem) 23vw, (min-width: 40rem) 30vw, 45vw',
    heading: 'h2',
  },
  compact: {
    list: 'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4',
    sizes: '(min-width: 56rem) 280px, (min-width: 40rem) 30vw, 45vw',
    heading: 'h4',
  },
} as const

interface Props {
  videos: readonly Video[]
  layout?: keyof typeof LAYOUTS
}

export default function VideoGrid({ videos, layout = 'page' }: Props) {
  const { list, sizes, heading } = LAYOUTS[layout]
  return (
    <ul role="list" className={list}>
      {videos.map((video) => (
        <li key={video.id}>
          <VideoCard video={video} sizes={sizes} heading={heading} />
        </li>
      ))}
    </ul>
  )
}
