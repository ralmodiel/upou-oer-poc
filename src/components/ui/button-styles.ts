// Shared class builders for Button, LinkButton and IconButton.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'
export type IconButtonSize = 'sm' | 'md'

const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap transition-[background-color,color,border-color,box-shadow,translate,filter] duration-200 ease-out-soft select-none disabled:pointer-events-none disabled:opacity-50 motion-safe:active:translate-y-px'

// Primary: the maroon fill with a top sheen and a soft drop; it lifts and brightens on hover and
// focus, with a paper ring inside the focus outline (and the TV glow outside it, its drop kept).
// Secondary: a frosted-glass pill that reads on the page and over pictures; hover and focus add a
// light top rim and keep the depth. Ghost: turns to glass on hover and focus, as the chips.
// Lifts are transforms (no reflow) and only without reduced motion.
const LIFT = 'motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5'
const VARIANT: Record<ButtonVariant, string> = {
  primary: `border border-transparent bg-action bg-(image:--gradient-action) text-on-action shadow-(--shadow-action) hover:brightness-110 focus-visible:shadow-[var(--shadow-action),var(--shadow-glow)] focus-visible:ring-2 focus-visible:ring-paper focus-visible:brightness-110 ${LIFT}`,
  secondary: `border border-glass-border bg-frost text-ink shadow-(--shadow-elev-1) backdrop-blur-md hover:bg-frost-2 hover:shadow-[inset_0_1px_0_var(--color-rim),var(--shadow-elev-2)] focus-visible:bg-frost-2 focus-visible:shadow-[inset_0_1px_0_var(--color-rim),var(--shadow-elev-2),var(--shadow-glow)] ${LIFT}`,
  ghost:
    'text-ink-2 hover:bg-frost-2 hover:text-ink hover:shadow-(--shadow-glass) focus-visible:bg-frost-2 focus-visible:text-ink focus-visible:shadow-[var(--shadow-glass),var(--shadow-glow)]',
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
