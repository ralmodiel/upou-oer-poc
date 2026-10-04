// HistoryOff: where Recently viewed sits, says when watch history is off (or kept out of
// suggestions) and turns it back on in one press. A div, not a section, so the home's band rhythm
// (browse.css counts sections) stays put.
import { useState } from 'react'
import { historyAllowed, setPrefs, usePrefs, useWatchHistory } from '../lib/storage'
import { ManageLink } from './browse-ui'
import Button from './ui/Button'

export default function HistoryOff() {
  const [prefs] = usePrefs()
  const { entries } = useWatchHistory()
  const [turnedOn, setTurnedOn] = useState(false)
  const allowed = historyAllowed(prefs)
  // After "Turn on", say so until the first video lands in Recently viewed.
  if (allowed && !(turnedOn && !entries.length)) return null

  const saved = prefs.history
  const turnOn = () => {
    setPrefs({ history: true, useHistory: true })
    setTurnedOn(true)
  }
  return (
    <div className="px-(--gutter) py-6">
      <div
        aria-live="polite"
        className="browse-panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-2"
      >
        {allowed ? (
          <p>Watch history is on. Videos you open will show up here.</p>
        ) : (
          <>
            <p className="min-w-0 flex-1 basis-64">
              {saved ? 'Suggestions from your watch history are off' : 'Watch history is off'}, so
              Recently viewed and Because you watched are hidden.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={turnOn}>
                {saved ? 'Turn on suggestions' : 'Turn on watch history'}
              </Button>
              <ManageLink />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
