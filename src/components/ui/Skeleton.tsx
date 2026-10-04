// Skeleton: loading placeholder with a slow sheen sweeping across (still without motion). Size it with `className` (e.g. "aspect-video w-full", "h-4 w-2/3");
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
      className={`bg-surface-2 from-transparent via-shimmer to-transparent bg-size-[200%_100%] bg-no-repeat motion-safe:bg-linear-to-r motion-safe:animate-shimmer ${ROUNDED[rounded]} ${className}`}
    />
  )
}
