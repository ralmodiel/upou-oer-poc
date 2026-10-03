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
