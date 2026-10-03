import { useEffect, useRef, useState } from 'react'
import { CheckIcon, ShareIcon } from '../../components/icons'
import Button from '../../components/ui/Button'
import './watch.css'

type State = 'idle' | 'copied' | 'manual'
const COPIED_MS = 2000

/**
 * Copies the page link and shows it on the button for two seconds (plus a toast); falls back to
 * the share sheet, then to a read-only field with the link selected for copying by hand.
 */
export default function ShareButton({ title }: { title: string }) {
  const [state, setState] = useState<State>('idle')
  const [url, setUrl] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fieldRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (state === 'manual') fieldRef.current?.select()
  }, [state])

  const share = async () => {
    const href = window.location.href
    setUrl(href)
    try {
      await navigator.clipboard.writeText(href)
      setState('copied')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState('idle'), COPIED_MS)
    } catch {
      try {
        await navigator.share({ title, url: href })
      } catch (err) {
        // The user closing the share sheet is not a failure.
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState('manual')
      }
    }
  }

  const copied = state === 'copied'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={copied ? <CheckIcon /> : <ShareIcon />}
        onClick={() => void share()}
        className={copied ? 'border-forest text-forest' : ''}
      >
        {copied ? 'Link copied' : 'Share'}
      </Button>
      <span role="status" className="text-sm font-medium text-forest">
        {copied && <span className="watch-toast inline-block">Copied to clipboard</span>}
      </span>
      {state === 'manual' && (
        <input
          ref={fieldRef}
          readOnly
          value={url}
          aria-label="Page link"
          onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-72 max-w-full rounded-pill border border-line bg-surface px-3 text-sm text-ink-2"
        />
      )}
    </span>
  )
}
