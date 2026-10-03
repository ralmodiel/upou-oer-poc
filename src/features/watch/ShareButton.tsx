import { useEffect, useRef, useState } from 'react'
import Button from '../../components/ui/Button'
import { CheckIcon, ShareIcon } from './icons'
import './watch.css'

/** Copies the page link (falls back to the share sheet) and confirms with a short toast. */
export default function ShareButton({ title }: { title: string }) {
  const [toast, setToast] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const show = (text: string) => {
    setToast(text)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(''), 2400)
  }

  const share = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      show('Link copied')
    } catch {
      try {
        await navigator.share({ title, url })
      } catch {
        show(`Copy this link: ${url}`)
      }
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" icon={<ShareIcon />} onClick={() => void share()}>
        Share
      </Button>
      <span role="status" className="text-sm font-medium text-forest">
        {toast && (
          <span key={toast} className="watch-toast inline-flex items-center gap-1">
            <CheckIcon className="size-4" />
            {toast}
          </span>
        )}
      </span>
    </span>
  )
}
