import { memo, useId } from 'react'
import { getCategories } from '../data/catalog'
import Chip from './ui/Chip'
import SectionHeading from './ui/SectionHeading'

/** Every collection as a chip with its count; scrolls sideways on phones, wraps from md up. */
function CollectionChips() {
  const headingId = useId()
  const categories = getCategories()
  return (
    <section aria-labelledby={headingId} className="border-t border-line px-(--gutter) pt-6 pb-8">
      <SectionHeading
        id={headingId}
        title="Collections"
        description="Browse by subject."
        seeAllTo="/collections"
        seeAllLabel={`All collections (${categories.length})`}
      />
      <ul
        role="list"
        className="-mx-(--gutter) mt-4 flex gap-2 overflow-x-auto scroll-px-(--gutter) px-(--gutter) pb-1 scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {categories.map((c) => (
          <li key={c.slug}>
            <Chip to={`/collections/${c.slug}`} active={false} count={c.count}>
              {c.name}
            </Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default memo(CollectionChips)
