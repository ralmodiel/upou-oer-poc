import Chip from '../../components/ui/Chip'
import { isGenericTag, tagKey } from '../../lib/tags'
import { tidyTag } from '../reel/plan'

/** Distinct, meaningful tags as search links. */
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
    <section className="mt-6">
      <h2 className="eyebrow">Topics</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {topics.slice(0, 12).map((tag) => (
          <li key={tag}>
            <Chip to={`/search?q=${encodeURIComponent(tag)}`}>{tidyTag(tag)}</Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}
