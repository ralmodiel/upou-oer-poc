// Shared class builders for Button, LinkButton and IconButton.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,border-color,box-shadow,translate] select-none disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-px'

// Filled buttons (logo maroon, deep band maroon in dark) get a paper ring inside the focus outline,
// so the outline never runs into the fill. Secondary buttons wear the forest outline.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-action text-on-action hover:bg-action-2 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-paper',
  secondary:
    'border border-forest/55 bg-surface text-forest hover:border-forest hover:bg-forest-soft',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
}

// A pressed toggle (Saved): maroon on paper, gold in dark.
export const PRESSED =
  'aria-pressed:border-maroon aria-pressed:text-maroon dark:aria-pressed:border-gold dark:aria-pressed:text-gold'

// Heights keep every target at or above 40px.
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-3.5 text-sm [&_svg]:size-4',
  md: 'h-11 px-5 text-sm [&_svg]:size-5',
  lg: 'h-12 px-6 text-base [&_svg]:size-5',
}

const ICON_SIZE: Record<IconButtonSize, string> = {
  sm: 'size-10 [&_svg]:size-5',
  md: 'size-11 [&_svg]:size-6',
}

export const buttonClass = (
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
) => `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${extra}`.trim()

export const iconButtonClass = (
  variant: ButtonVariant = 'ghost',
  size: IconButtonSize = 'sm',
  extra = '',
) => `${BASE} ${VARIANT[variant]} ${ICON_SIZE[size]} ${extra}`.trim()
