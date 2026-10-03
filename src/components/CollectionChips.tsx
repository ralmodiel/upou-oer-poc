import { memo, useId } from 'react'
import { getCategories } from '../data/catalog'
import { useRovingRow } from './hooks'
import Chip from './ui/Chip'
import { MARK, toneOf } from './tones'
import SectionHeading from './ui/SectionHeading'

/**
 * Every collection as a chip with its brand dot and count, the one with the newest video first
 * (like the home rows); scrolls sideways on phones, wraps from md up. One Tab stop, and one stop
 * for ↑ / ↓ (data-spatial="group"): ← / → move between chips.
 */
function CollectionChips() {
  const headingId = useId()
  const categories = getCategories('latest')
  const { listProps, tabIndexOf } = useRovingRow(categories.length)
  return (
    <section aria-labelledby={headingId} className="px-(--gutter) py-8 sm:py-10">
      <SectionHeading
        id={headingId}
        title="Collections"
        description="Browse by subject."
        seeAllTo="/collections"
        seeAllLabel={`All collections (${categories.length})`}
      />
      <ul
        role="list"
        data-spatial="group"
        {...listProps}
        className="-mx-(--gutter) mt-5 flex gap-2 overflow-x-auto scroll-px-(--gutter) px-(--gutter) pb-1 scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {categories.map((c, i) => (
          <li key={c.slug}>
            <Chip
              to={`/collections/${c.slug}`}
              active={false}
              count={c.count}
              dot={MARK[toneOf(c.slug)]}
              tabIndex={tabIndexOf(i)}
            >
              {c.name}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default memo(CollectionChips)
