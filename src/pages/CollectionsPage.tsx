import CategoryCard from '../components/CategoryCard'
import { useDocumentTitle } from '../components/hooks'
import SectionHeading from '../components/ui/SectionHeading'
import { getCategories, videos } from '../data/catalog'

export default function CollectionsPage() {
  useDocumentTitle('Collections · UPOU Networks')
  const categories = getCategories()
  return (
    <div className="px-(--gutter) pt-6 pb-16 sm:pt-8">
      <SectionHeading
        as="h1"
        eyebrow="Browse by subject"
        title="Collections"
        description={`${categories.length} collections, ${videos.length.toLocaleString('en')} videos. Open a collection to see everything in it, newest first.`}
      />
      <ul
        role="list"
        className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      >
        {categories.map((category) => (
          <li key={category.slug}>
            <CategoryCard category={category} />
          </li>
        ))}
      </ul>
    </div>
  )
}
