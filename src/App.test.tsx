import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { setCatalog } from './data/testing'
import { testVideo } from './features/reel/testing'

it('restores a reloaded watch page to its scroll position once the page is in, not its fallback', async () => {
  setCatalog([testVideo])
  const path = `/watch/${testVideo.id}`
  window.history.replaceState(null, '', path)
  sessionStorage.setItem('react-router-scroll-positions', JSON.stringify({ [path]: 700 }))
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const { default: App } = await import('./App')

  render(<App />)
  // The lazy route is still loading: its short fallback would clamp or shift the position.
  expect(scrollTo).not.toHaveBeenCalledWith(0, 700)
  // The whole app and the watch page load here: slow beside the rest of a full run.
  await screen.findByRole('heading', { level: 1, name: testVideo.title }, { timeout: 15_000 })
  expect(scrollTo).toHaveBeenCalledWith(0, 700)
}, 30_000)
