import Chip from '../../components/ui/Chip'
import { isGenericTag, tagKey, tidyTag } from '../../lib/tags'

/** Distinct, meaningful tags as search links; a short list sits beside its label. */
export default function WatchTags({ tags }: { tags: readonly string[] }) {
  const seen = new Set<string>()
  const topics = tags.filter((tag) => {
    const key = tagKey(tag)
    if (!key || isGenericTag(tag) || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!topics.length) return null
  return (
    <section aria-labelledby="topics-heading" className="mt-6 sm:flex sm:items-baseline sm:gap-4">
      <h2 id="topics-heading" className="eyebrow shrink-0">
        Topics
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2 sm:mt-0">
        {topics.slice(0, 12).map((tag) => (
          <li key={tag}>
            <Chip to={`/search?q=${encodeURIComponent(tag)}`}>{tidyTag(tag)}</Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}
