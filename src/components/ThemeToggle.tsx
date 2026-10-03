// ThemeToggle: light / dark / system. Default: a labelled segmented control. `compact`: one icon
// button that flips the effective theme (light <-> dark), so the first tap always changes
// something; "system" comes back through the Help menu (Header), which lists THEMES too.
import { THEMES, useTheme, type ResolvedTheme, type Theme } from '../lib/theme'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'
import IconButton from './ui/IconButton'

const ICONS: Record<Theme, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

interface Props {
  compact?: boolean
  className?: string
}

export default function ThemeToggle({ compact = false, className = '' }: Props) {
  const { theme, resolved, setTheme } = useTheme()

  if (compact) {
    const next: ResolvedTheme = resolved === 'dark' ? 'light' : 'dark'
    const Icon = resolved === 'dark' ? MoonIcon : SunIcon
    return (
      <IconButton
        label={`Theme: ${resolved}. Switch to ${next}`}
        icon={<Icon />}
        onClick={() => setTheme(next)}
        className={className}
      />
    )
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex h-11 shrink-0 items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5 ${className}`}
    >
      {THEMES.map(({ value, label }) => {
        const Icon = ICONS[value]
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={`grid size-10 cursor-pointer place-items-center rounded-pill transition-colors ${
              selected ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <Icon className="size-4" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
