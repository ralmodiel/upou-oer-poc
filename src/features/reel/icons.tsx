import type { SVGProps } from 'react'

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function SoundOnIcon() {
  return (
    <svg {...base}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}

export function SoundOffIcon() {
  return (
    <svg {...base}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      <path d="m16 9 6 6M22 9l-6 6" />
    </svg>
  )
}

export function SkipIcon() {
  return (
    <svg {...base}>
      <path d="M5 5.5v13l9-6.5-9-6.5Z" fill="currentColor" />
      <path d="M19 5v14" />
    </svg>
  )
}
