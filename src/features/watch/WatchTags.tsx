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
    <section aria-labelledby="topics-heading" className="watch-row">
      <h2 id="topics-heading" className="eyebrow">
        Topics
      </h2>
      {/* One stop for ↑ / ↓ on a remote; ← / → walk the chips. */}
      <ul role="list" data-spatial="group" className="flex flex-wrap gap-2">
        {topics.slice(0, 12).map((tag) => (
          <li key={tag}>
            <Chip to={`/search?q=${encodeURIComponent(tag)}`}>{tidyTag(tag)}</Chip>
          </li>
        ))}
      </ul>
    </section>
  )
}
