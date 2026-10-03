// LinkButton: a Button-styled link. `to` renders a router <Link> (with `state`, `replace`,
// `preventScrollReset`); `href` renders <a>, and `external` adds target=_blank + rel. Same
// `variant` / `size` / `icon` / `iconEnd` as Button.
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles'

export interface LinkButtonProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'children'
> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconEnd?: ReactNode
  children?: ReactNode
  to?: To
  href?: string
  external?: boolean
  state?: unknown
  replace?: boolean
  preventScrollReset?: boolean
}

export default function LinkButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  className = '',
  children,
  to,
  href,
  external,
  state,
  replace,
  preventScrollReset,
  ...rest
}: LinkButtonProps) {
  const cls = buttonClass(variant, size, className)
  const content = (
    <>
      {icon}
      {children}
      {iconEnd}
    </>
  )
  if (to !== undefined) {
    return (
      <Link
        to={to}
        state={state}
        replace={replace}
        preventScrollReset={preventScrollReset}
        className={cls}
        {...rest}
      >
        {content}
      </Link>
    )
  }
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}
  return (
    <a href={href} className={cls} {...externalProps} {...rest}>
      {content}
    </a>
  )
}
