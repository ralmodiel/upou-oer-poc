import { useEffect, useState } from 'react'
import { usePersistentState } from '../../lib/storage'
import './watch.css'

/** One-time "Esc goes back" tip (fine pointers only); remembered under upou:esc-hint. */
export default function EscHint() {
  const [seen, setSeen] = usePersistentState('upou:esc-hint', false)
  const [show] = useState(!seen)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!show) return
    setSeen(true)
    const timer = setTimeout(() => setGone(true), 7000)
    return () => clearTimeout(timer)
  }, [show, setSeen])

  if (!show || gone) return null
  return (
    <p className="watch-hint hidden items-center gap-1.5 rounded-pill bg-paper/80 px-2.5 py-1 text-sm text-ink-2 pointer-fine:inline-flex">
      Press
      <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-xs font-semibold text-ink">
        Esc
      </kbd>
      to go back
    </p>
  )
}
