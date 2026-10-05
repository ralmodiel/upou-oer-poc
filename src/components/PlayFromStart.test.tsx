import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { testVideo } from '../features/reel/testing'
import { savePosition, setPrefs } from '../lib/storage'
import PlayFromStart from './PlayFromStart'

function Watching() {
  const { pathname, state } = useLocation()
  return <p>{`${pathname} ${JSON.stringify(state)}`}</p>
}

const renderButton = () =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: '/', element: <PlayFromStart video={testVideo} /> },
          { path: '/watch/:id', Component: Watching },
        ],
        { initialEntries: ['/'] },
      )}
    />,
  )

describe('Play from start', () => {
  it('shows only while a place is saved, and opens the video asking it to start over', () => {
    renderButton()
    expect(screen.queryByRole('link')).toBeNull()
    // Comes in when the player leaves a place behind (another tab, or back from watching).
    act(() => savePosition(testVideo.id, 75, 600))
    const link = screen.getByRole('link', { name: 'Play from start' })
    expect(link).toHaveAttribute('href', `/watch/${testVideo.id}`)
    fireEvent.click(link)
    expect(
      screen.getByText(`/watch/${testVideo.id} {"fromStart":{"id":"${testVideo.id}","t":75}}`),
    ).toBeVisible()
  })

  it('is gone while watch history is not used', () => {
    savePosition(testVideo.id, 75, 600)
    setPrefs({ useHistory: false })
    renderButton()
    expect(screen.queryByRole('link')).toBeNull()
    act(() => setPrefs({ useHistory: true }))
    expect(screen.getByRole('link', { name: 'Play from start' })).toBeVisible()
  })
})
