// NotFound: the one "nothing here" page body — breadcrumb trail, eyebrow, serif title, a line of
// explanation and two actions (first primary, second secondary). Presentation only: the page sets
// its own title and meta tags (`useSeo`). Used by the 404 route, missing collections and videos.
import type { ReactNode } from 'react'
import type { To } from 'react-router'
import Breadcrumbs, { type Crumb } from './Breadcrumbs'
import LinkButton from './LinkButton'
import SectionHeading from './SectionHeading'

export interface NotFoundAction {
  label: string
  to: To
}

export interface NotFoundProps {
  title: string
  /** One line under the title. */
  children?: ReactNode
  /** Trail above the title; the last crumb names the missing page. Default: Browse › Not found. */
  crumbs?: Crumb[]
  eyebrow?: string
  /** Primary, then secondary. Default: Browse videos, All collections. */
  actions?: [NotFoundAction, NotFoundAction?]
  className?: string
}

const DEFAULT_CRUMBS: Crumb[] = [{ label: 'Browse', to: '/' }, { label: 'Not found' }]
const DEFAULT_ACTIONS: [NotFoundAction, NotFoundAction] = [
  { label: 'Browse videos', to: '/' },
  { label: 'All collections', to: '/collections' },
]

export default function NotFound({
  title,
  children,
  crumbs = DEFAULT_CRUMBS,
  eyebrow = 'Not found',
  actions = DEFAULT_ACTIONS,
  className = '',
}: NotFoundProps) {
  const [primary, secondary] = actions
  return (
    <div className={`px-(--gutter) pt-6 pb-16 sm:pt-8 ${className}`}>
      <Breadcrumbs items={crumbs} />
      <SectionHeading
        as="h1"
        className="mt-4"
        eyebrow={eyebrow}
        title={title}
        description={children}
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton to={primary.to}>{primary.label}</LinkButton>
        {secondary && (
          <LinkButton to={secondary.to} variant="secondary">
            {secondary.label}
          </LinkButton>
        )}
      </div>
    </div>
  )
}
