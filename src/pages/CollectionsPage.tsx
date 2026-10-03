import CategoryCard from '../components/CategoryCard'
import PageBand from '../components/PageBand'
import { getCategories, videos } from '../data/catalog'
import { collectionsSeo, useSeo } from '../lib/seo'

export default function CollectionsPage() {
  const categories = getCategories()
  useSeo(collectionsSeo(categories))
  return (
    <>
      <PageBand tone="forest" eyebrow="Browse by subject" title="Collections">
        {categories.length} collections, {videos.length.toLocaleString('en')} videos. Open a
        collection to see everything in it, newest first.
      </PageBand>
      <div className="px-(--gutter) pt-8 pb-16">
        <ul
          role="list"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
        >
          {categories.map((category) => (
            <li key={category.slug}>
              <CategoryCard category={category} />
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
