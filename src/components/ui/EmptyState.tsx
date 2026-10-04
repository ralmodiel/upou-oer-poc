// EmptyState: friendly empty / error block. Optional `icon`, `title`, explanatory text as children,
// one `action` (a Button or LinkButton); `compact` tightens the vertical padding.
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  compact?: boolean
  className?: string
}

export default function EmptyState({
  icon,
  title,
  children,
  action,
  compact,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`mx-auto flex max-w-md flex-col items-center text-center ${compact ? 'py-8' : 'py-16 sm:py-24'} ${className}`}
    >
      {icon && (
        <div className="mb-5 grid size-14 place-items-center rounded-pill bg-maroon-soft text-maroon shadow-elev-2 ring-1 ring-current/15 ring-inset [&_svg]:size-7">
          {icon}
        </div>
      )}
      <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">{title}</h2>
      {children && <div className="mt-2 text-base leading-relaxed text-ink-2">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
