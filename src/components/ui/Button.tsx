// Button: `variant` primary|secondary|ghost, `size` sm|md|lg, leading `icon` / trailing `iconEnd`,
// plus native <button> props; `type` defaults to "button".
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-styles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconEnd?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </button>
  )
}
