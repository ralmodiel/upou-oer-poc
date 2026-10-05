import { useEffect, useId, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../components/icons'
import IconButton from '../../components/ui/IconButton'
import { citeOf, peekCite, type Citation } from '../../data/cites'
import type { Video } from '../../types'

type Level = 'h2' | 'h3'
interface Props {
  video: Video
  /** h2 on the watch page, h3 in the quick look (under its h2 title). */
  as?: Level
  className?: string
}
const COPIED_MS = 2000
// URLs in the citation become links; a closing full stop or bracket stays text
const URL_RE = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)\]'"])/

/**
 * How to cite the video, always shown in full (never folded, clamped or hidden): the source
 * page's own citation, or one generated from the video's details, as
 * selectable text with its link, and a Copy citation button.
 */
export default function WatchCite({ video, as = 'h2', className = '' }: Props) {
  const [loaded, setLoaded] = useState<{ id: string; citation: Citation }>()
  useEffect(() => {
    let live = true
    void citeOf(video).then((citation) => {
      if (live) setLoaded({ id: video.id, citation })
    })
    return () => {
      live = false
    }
  }, [video])
  // Once cites.json is in, the next video's citation shows on its first paint (no shift); before
  // that the section waits for it, so a crawled citation never flashes a generated one first.
  const citation = peekCite(video) ?? (loaded?.id === video.id ? loaded.citation : undefined)
  // keyed, so the next video starts with a fresh Copy button
  return citation ? (
    <CitationBox key={video.id} citation={citation} as={as} className={className} />
  ) : null
}

function CitationBox({
  citation: { text: cite },
  as,
  className,
}: {
  citation: Citation
  as: Level
  className: string
}) {
  const headingId = useId()
  const Heading = as
  const textRef = useRef<HTMLParagraphElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(cite)
      setState('copied')
      timer.current = setTimeout(() => setState('idle'), COPIED_MS)
    } catch {
      // No clipboard (an insecure page, a denied permission): select the text to copy by hand.
      if (textRef.current) window.getSelection()?.selectAllChildren(textRef.current)
      setState('manual')
    }
  }

  const copied = state === 'copied'
  // Phones in portrait start with just the label; a tap opens the citation and Copy.
  const [open, setOpen] = useState(false)
  const shut = open ? '' : 'max-sm:portrait:hidden'
  return (
    <section
      aria-label="How to cite"
      className={`max-w-2xl rounded-card border border-glass-border bg-surface px-3.5 py-3 shadow-(--shadow-elev-1) sm:px-4 ${className}`}
    >
      {/* A quiet label, not a display heading: the citation is the content. */}
      {/* The label, with Copy beside it as an icon (named and titled "Copy citation"). */}
      <div className="-my-1.5 flex items-center gap-1">
        <Heading id={headingId} className="eyebrow">
          <span className="max-sm:portrait:hidden">How to cite</span>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="hidden min-h-11 cursor-pointer items-center gap-1 text-maroon underline underline-offset-4 max-sm:portrait:inline-flex"
          >
            How to cite
            <ChevronDownIcon
              className={`size-4 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </Heading>
        <IconButton
          label={copied ? 'Copied' : 'Copy citation'}
          icon={copied ? <CheckIcon /> : <CopyIcon />}
          onClick={() => void copy()}
          className={`${copied ? 'text-forest' : 'text-ink-2'} ${shut}`}
        />
        {/* Always in the tree (empty, it has no width), so screen readers hear what it says. */}
        <span role="status" className="text-xs text-ink-2">
          {copied && <span className="sr-only">Citation copied to clipboard</span>}
          {state === 'manual' && 'Selected: press Ctrl+C (⌘C on a Mac) to copy it.'}
        </span>
      </div>
      <p
        ref={textRef}
        className={`mt-1.5 text-sm leading-normal wrap-anywhere whitespace-pre-line text-ink-2 select-text ${shut}`}
      >
        {cite.split(URL_RE).map((part, i) =>
          i % 2 ? (
            // No hidden "new tab" words inside: they would be copied with a selected citation.
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${part} (opens in a new tab)`}
              className="font-semibold text-maroon underline underline-offset-4 hover:text-maroon-2"
            >
              {part}
            </a>
          ) : (
            part
          ),
        )}
      </p>
    </section>
  )
}

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </svg>
)
