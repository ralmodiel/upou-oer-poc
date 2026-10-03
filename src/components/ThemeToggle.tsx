// ThemeToggle: one icon button that flips the effective theme (light <-> dark), so the first press
// always changes something and the header keeps a single stop for it. "System" (and all three
// choices) live in the Help menu (Header).
import { useTheme, type ResolvedTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './icons'
import IconButton from './ui/IconButton'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, setTheme } = useTheme()
  const next: ResolvedTheme = resolved === 'dark' ? 'light' : 'dark'
  const Icon = resolved === 'dark' ? MoonIcon : SunIcon
  return (
    <IconButton
      label={`Theme: ${resolved}. Switch to ${next}`}
      icon={<Icon />}
      onClick={() => setTheme(next)}
      data-spatial="aside"
      className={className}
    />
  )
}
