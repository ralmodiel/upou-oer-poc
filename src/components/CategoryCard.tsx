import { memo } from 'react'
import { Link } from 'react-router'
import { getCategoryVideos, type Category } from '../data/catalog'
import { srcSetOf } from './media'

const SIZES = '(min-width: 96rem) 23vw, (min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 92vw'

/** A collection: cover from its newest video, name, count and a few sample titles. */
function CategoryCard({ category }: { category: Category }) {
  const { slug, name, count, cover } = category
  const samples = getCategoryVideos(slug).slice(0, 3)
  return (
    <article className="group/cat relative flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-[translate,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-lift has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-maroon has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-paper motion-reduce:transition-none">
      <img
        src={cover.thumbnail}
        srcSet={srcSetOf(cover)}
        sizes={SIZES}
        alt=""
        loading="lazy"
        decoding="async"
        className="aspect-video w-full bg-surface-2 object-cover"
      />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="font-display text-2xl text-ink transition-colors group-hover/cat:text-maroon">
          <Link to={`/collections/${slug}`} className="outline-none after:absolute after:inset-0">
            {name}
          </Link>
        </h2>
        <p className="mt-0.5 text-sm text-ink-3">
          {count} {count === 1 ? 'video' : 'videos'}
        </p>
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm text-ink-2">
          {samples.map((v) => (
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
