import { useEffect, useState } from 'react'
import { usePointerKind } from '../../lib/pointer'
import { usePersistentState } from '../../lib/storage'
import './watch.css'

/**
 * One-time "Esc goes back" tip, remembered under upou:esc-hint. Only for fine pointers: touch
 * devices have no Esc, and seeing it there would also spend the one showing.
 */
export default function EscHint() {
  const fine = usePointerKind() === 'fine'
  const [seen, setSeen] = usePersistentState('upou:esc-hint', false)
  const [show] = useState(fine && !seen)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!show) return
    setSeen(true)
    const timer = setTimeout(() => setGone(true), 7000)
    return () => clearTimeout(timer)
  }, [show, setSeen])

  if (!show || gone) return null
  return (
    <p className="watch-hint inline-flex items-center gap-1.5 rounded-pill bg-paper/80 px-2.5 py-1 text-sm text-ink-2">
      Press
      <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-xs font-semibold text-ink">
        Esc
      </kbd>
      to go back
    </p>
  )
}
