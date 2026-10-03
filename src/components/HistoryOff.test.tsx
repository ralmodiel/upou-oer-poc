import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readPrefs, setPrefs, useWatchHistory } from '../lib/storage'
import HistoryOff from './HistoryOff'

function Recorder() {
  const { record } = useWatchHistory()
  return (
    <button type="button" onClick={() => record('a')}>
      Watch
    </button>
  )
}

describe('HistoryOff', () => {
  it('stays hidden while watch history is saved and used', () => {
    const { container } = render(<HistoryOff />)
    expect(container).toBeEmptyDOMElement()
  })

  it('turns watch history back on in one press, then says so until a video lands', () => {
    setPrefs({ history: false })
    render(
      <>
        <HistoryOff />
        <Recorder />
      </>,
    )
    expect(screen.getByText(/Watch history is off/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on watch history' }))
    expect(readPrefs()).toMatchObject({ history: true, useHistory: true })
    expect(screen.getByText(/Watch history is on/)).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'Watch' }).click())
    expect(screen.queryByText(/Watch history is on/)).toBeNull()
  })

  it('offers suggestions back when history is saved but kept out of them', () => {
    setPrefs({ useHistory: false })
    render(<HistoryOff />)
    expect(screen.getByText(/Suggestions from your watch history are off/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on suggestions' }))
    expect(readPrefs().useHistory).toBe(true)
  })

  it('links to the privacy settings', () => {
    setPrefs({ history: false })
    render(<HistoryOff />)
    expect(screen.getByRole('button', { name: 'Privacy settings' })).toBeInTheDocument()
  })
})
