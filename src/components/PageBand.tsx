// PageBand: full-bleed solid brand band that opens a page (home intro, collections, a collection):
// a short rule, optional eyebrow, the page title and a line of text. `aside` (the collection
// mosaic) sits beside the band from md up and below it on phones, never under the colour. `action`
// (the home intro's How it works chip) sits at the band's bottom right from md up, below on phones.
import type { ReactNode } from 'react'
import { BAND, type Tone } from './tones'

interface Props {
  tone: Tone
  title: ReactNode
  eyebrow?: ReactNode
  /** One line under the title. */
  children?: ReactNode
  aside?: ReactNode
  /** A control on the band, beside the text from md up. */
  action?: ReactNode
  /** Title size; the page-title scale by default. */
  titleClassName?: string
  /** Less vertical padding (the home intro line). */
  compact?: boolean
  className?: string
}

const EYEBROW = 'text-xs font-semibold tracking-[0.08em] uppercase'

export default function PageBand({
  tone,
  title,
  eyebrow,
  children,
  aside,
  action,
  titleClassName = 'text-title',
  compact = false,
  className = '',
}: Props) {
  const band = BAND[tone]
  const eyebrowColor = tone === 'gold' ? 'text-charcoal' : 'text-band-gold'
  return (
    <div
      className={`grid ${aside ? 'md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : ''} ${className}`}
    >
      <div
        className={`min-w-0 px-(--gutter) ${compact ? 'py-6 sm:py-7' : 'py-7 sm:py-9'} ${aside ? 'md:pr-10' : ''} ${action ? 'md:flex md:items-end md:justify-between md:gap-x-10' : ''} ${band.fill} ${band.text}`}
      >
        <div className="min-w-0">
          <span aria-hidden="true" className={`block h-1 w-12 rounded-pill ${band.rule}`} />
          {eyebrow && <p className={`mt-4 ${EYEBROW} ${eyebrowColor}`}>{eyebrow}</p>}
          <h1
            className={`font-display text-balance ${eyebrow ? 'mt-1.5' : 'mt-4'} ${titleClassName}`}
          >
            {title}
          </h1>
          {children && (
            <div className={`mt-2 max-w-3xl text-sm/relaxed text-pretty ${band.muted}`}>
              {children}
            </div>
          )}
        </div>
        {action && <div className="mt-4 shrink-0 md:mt-0">{action}</div>}
      </div>
      {aside && <div className="relative isolate min-h-20 overflow-hidden md:min-h-0">{aside}</div>}
    </div>
  )
}
