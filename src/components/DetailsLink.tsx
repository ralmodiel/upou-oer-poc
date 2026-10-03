import { use } from 'react'
import { Link, type LinkProps } from 'react-router'
import { DetailsContext, detailsSearch } from './details'

type Props = Omit<LinkProps, 'to' | 'replace' | 'state'> & { id: string }

/** Opens the detail modal (`?v=<id>`) without resetting the scroll position behind it. */
export default function DetailsLink({ id, ...props }: Props) {
  const { base, replace = false, state } = use(DetailsContext)
  return (
    <Link
      to={{ search: detailsSearch(base, id) }}
      replace={replace}
      state={state}
      preventScrollReset
      {...props}
    />
  )
}
