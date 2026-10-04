import { useId, useState } from 'react'
import { ChevronRightIcon } from '../../components/icons'
import './watch.css'

// Four lines at the description's measure (watch.css) hold about 290 characters at most, so a
// longer text always has more to show: folding by length decides before the first paint, and the
// toggle never appears or goes later (no layout shift).
export const FOLD_AT = 320

/** The source page's description at a readable measure; a long one opens folded to four lines. */
export default function WatchDescription({ text }: { text: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const long = text.length > FOLD_AT
  return (
    <div className="watch-desc">
      <p
        id={id}
        data-folded={(long && !open) || undefined}
        className="text-base leading-relaxed whitespace-pre-line text-ink-2"
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="mt-1 inline-flex h-10 cursor-pointer items-center gap-1 text-sm font-semibold text-maroon hover:text-maroon-2"
        >
          {open ? 'Show less' : 'Show more'}
          <ChevronRightIcon
            className={`size-4 transition-transform motion-reduce:transition-none ${open ? '-rotate-90' : 'rotate-90'}`}
          />
        </button>
      )}
    </div>
  )
}
