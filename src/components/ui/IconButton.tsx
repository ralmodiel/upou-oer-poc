// IconButton: icon-only button. `label` (required) is the accessible name and tooltip; `icon` is the
// SVG; `size` sm (40px) | md (44px); `variant` ghost|secondary|primary; `pressed` sets aria-pressed.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { iconButtonClass, type ButtonVariant, type IconButtonSize } from './button-styles'

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  label: string
  icon: ReactNode
  size?: IconButtonSize
  variant?: ButtonVariant
  pressed?: boolean
}

export default function IconButton({
  label,
  icon,
  size = 'sm',
  variant = 'ghost',
  pressed,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={iconButtonClass(variant, size, className)}
      {...rest}
    >
      {icon}
    </button>
  )
}
