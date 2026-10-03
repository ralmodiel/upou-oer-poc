// Badge: small pill label. `tone` neutral|maroon|forest|amber|gold (default neutral).
import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'maroon' | 'forest' | 'amber' | 'gold'

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  title?: string
}

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  maroon: 'bg-maroon-soft text-maroon',
  forest: 'bg-forest-soft text-forest',
  amber: 'bg-amber text-charcoal',
  gold: 'bg-gold text-charcoal',
}

export default function Badge({ children, tone = 'neutral', className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
