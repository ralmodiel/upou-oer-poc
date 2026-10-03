// ThemeToggle: light / dark / system. Default: a labelled segmented control; `compact`: a single
// icon button that cycles through the three (phone header).
import { useTheme, type Theme } from '../lib/theme'
import { MonitorIcon, MoonIcon, SunIcon } from './icons'
import IconButton from './ui/IconButton'

const OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
]

interface Props {
  compact?: boolean
  className?: string
}

export default function ThemeToggle({ compact = false, className = '' }: Props) {
  const { theme, resolved, setTheme } = useTheme()

  if (compact) {
    const index = OPTIONS.findIndex((o) => o.value === theme)
    const current = OPTIONS[index]
    const next = OPTIONS[(index + 1) % OPTIONS.length]
    const now = theme === 'system' ? `System (${resolved})` : current.label
    return (
      <IconButton
        label={`Theme: ${now}. Switch to ${next.label}`}
        icon={<current.Icon />}
        onClick={() => setTheme(next.value)}
        className={className}
      />
    )
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex h-10 shrink-0 items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={`grid size-9 cursor-pointer place-items-center rounded-pill transition-colors ${
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
