// Skeleton: loading placeholder. Size it with `className` (e.g. "aspect-video w-full", "h-4 w-2/3");
// `rounded` md|card|pill (default md).
export interface SkeletonProps {
  className?: string
  rounded?: 'md' | 'card' | 'pill'
}

const ROUNDED = { md: 'rounded-md', card: 'rounded-card', pill: 'rounded-pill' }

export default function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-surface-2 motion-safe:animate-pulse ${ROUNDED[rounded]} ${className}`}
    />
  )
}
