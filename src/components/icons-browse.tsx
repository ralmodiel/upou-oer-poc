import type { SVGProps } from 'react'

// Icons used by the browse, collections and search surfaces (icons.tsx holds the shared set).
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, strokeWidth = 2, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const BookmarkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 4.5h12v16l-6-4.2-6 4.2z" />
  </Icon>
)

export const BookmarkFilledIcon = (props: IconProps) => (
  <Icon {...props}>
    <path fill="currentColor" d="M6 4.5h12v16l-6-4.2-6 4.2z" />
  </Icon>
)

export const ArrowRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const CollectionIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Icon>
)

export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
)

export const CompassIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15 9-2 5-4 1 2-5z" />
  </Icon>
)
