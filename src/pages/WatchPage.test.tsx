import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REEL_MS } from '../features/reel/PromoReel'
import { DECODE_CAP_MS } from '../features/reel/preload'
import { testVideo } from '../features/reel/testing'
import WatchPage from './WatchPage'

vi.mock('../data/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/catalog')>()
  const { testVideo } = await import('../features/reel/testing')
  return { ...actual, getVideo: (id?: string) => (id === testVideo.id ? testVideo : undefined) }
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/watch/:id', Component: WatchPage },
      { path: '/', element: <p>Home</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  vi.useRealTimers()
})

describe('WatchPage', () => {
  it('plays the promo reel first, then the YouTube player', async () => {
    vi.useFakeTimers()
    renderAt(`/watch/${testVideo.id}`)

    expect(
      screen.getByRole('region', { name: `Promo reel: ${testVideo.title}` }),
    ).toBeInTheDocument()
    expect(screen.queryByTitle(`${testVideo.title} (YouTube video)`)).not.toBeInTheDocument()
    expect(document.title).toBe(`${testVideo.title} · UPOU Networks`)

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    await act(() => vi.advanceTimersByTimeAsync(REEL_MS))

    const frame = screen.getByTitle(`${testVideo.title} (YouTube video)`)
    expect(frame).toHaveAttribute(
      'src',
      expect.stringMatching(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12345\?/),
    )
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(screen.queryByRole('region', { name: /Promo reel/ })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('upou:history') ?? '[]')[0]?.id).toBe(testVideo.id)
  })

  it('goes home on Escape when opened directly, replacing the watch entry', async () => {
    const router = renderAt(`/watch/${testVideo.id}`)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('shows a friendly not-found screen for unknown ids', () => {
    renderAt('/watch/does-not-exist')
    expect(screen.getByRole('heading', { name: 'Video not found' })).toBeInTheDocument()
    expect(document.title).toBe('Video not found · UPOU Networks')
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/')
  })
})
