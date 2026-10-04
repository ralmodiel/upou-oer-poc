import type { SVGProps } from 'react'

/** Arrow-left for Back; the shared set in components/icons has the rest. */
export const BackIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)

/** Three level bars beside "Now playing" in Up next. */
export const NowPlayingIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
    <rect x="2" y="6" width="3" height="8" rx="1" />
    <rect x="6.5" y="2" width="3" height="12" rx="1" />
    <rect x="11" y="8" width="3" height="6" rx="1" />
  </svg>
)

/** Circular arrow for Up next's refresh. */
export const RefreshIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
  </svg>
)
