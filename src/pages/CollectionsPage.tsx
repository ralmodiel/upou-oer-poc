import CategoryCard, { CategoryListItem } from '../components/CategoryCard'
import PageBand from '../components/PageBand'
import { useMediaQuery } from '../components/browse-hooks'
import { getCategories, videos } from '../data/catalog'
import { collectionsSeo, useSeo } from '../lib/seo'

// Covers load at once for the first screen: a row of mosaics (up to four), or eight list rows.
const EAGER_CARDS = 4
const EAGER_ROWS = 8

export default function CollectionsPage() {
  const categories = getCategories()
  useSeo(collectionsSeo(categories))
  // Phones get a compact list (cover, name, count); mosaic cards from md up.
  const wide = useMediaQuery('(min-width: 48rem)')
  return (
    <>
      <PageBand tone="forest" eyebrow="Browse by subject" title="Collections">
        {categories.length} collections, {videos.length.toLocaleString('en')} videos. Open a
        collection to see everything in it, newest first.
      </PageBand>
      <div className="px-(--gutter) pt-6 pb-12 md:pt-8 md:pb-16">
        {wide ? (
          <ul role="list" className="grid grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
            {categories.map((category, i) => (
              <li key={category.slug}>
                <CategoryCard category={category} eager={i < EAGER_CARDS} />
              </li>
            ))}
          </ul>
        ) : (
          <ul
            role="list"
            className="page-glass divide-y divide-glass-border overflow-hidden rounded-card border border-glass-border bg-surface"
          >
            {categories.map((category, i) => (
              <li key={category.slug}>
                <CategoryListItem category={category} eager={i < EAGER_ROWS} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
