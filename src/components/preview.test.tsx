import { act, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../data/testing'
import VideoGrid from './VideoGrid'
import { stopPreview } from './preview'
import { fixtureVideos } from './test-fixtures'

// The reel itself is covered by its own tests; here it only needs to mount and complete.
vi.mock('../features/reel/PromoReel', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" data-testid="reel" onClick={onComplete}>
      reel
    </button>
  ),
}))

setCatalog(fixtureVideos)

// No hover (previews start from focus), reduced motion as given.
const mediaQueries = (reduce: boolean) => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('reduce') ? reduce : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

function renderGrid() {
  const router = createMemoryRouter([
    { path: '/', element: <VideoGrid videos={fixtureVideos.slice(0, 3)} /> },
    { path: '/watch/:id', element: <p>Player</p> },
  ])
  render(<RouterProvider router={router} />)
}

const previews = () => document.querySelectorAll('[data-preview]')
const cardLink = (i: number) => screen.getAllByRole('link', { name: /^Play / })[i]
const previewIn = (i: number) => cardLink(i).closest('article')!.querySelector('[data-preview]')

describe('card previews', () => {
  beforeEach(() => mediaQueries(false))

  it('mounts the reel for the focused card only, and unmounts it on blur', async () => {
    renderGrid()
    expect(previews()).toHaveLength(0)
    act(() => cardLink(0).focus())
    expect(previews()).toHaveLength(1)
    expect(previewIn(0)).not.toBeNull()
    expect(await screen.findByTestId('reel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Climate Change Basics' })).toBeVisible()

    act(() => cardLink(1).focus())
    expect(previews()).toHaveLength(1)
    expect(previewIn(0)).toBeNull()
    expect(previewIn(1)).not.toBeNull()

    act(() => cardLink(1).blur())
    expect(previews()).toHaveLength(0)
  })

  it('holds the end card briefly after the reel completes, then shows the thumbnail again', async () => {
    renderGrid()
    act(() => cardLink(0).focus())
    ;(await screen.findByTestId('reel')).click()
    expect(previews()).toHaveLength(1)
    await waitFor(() => expect(previews()).toHaveLength(0), { timeout: 2000 })
    // Still focused: no restart until the card is left and re-entered.
    expect(document.activeElement).toBe(cardLink(0))
  })

  it('is dismissed by Esc (which is then not Back) and by stopPreview()', () => {
    renderGrid()
    act(() => cardLink(2).focus())
    expect(previews()).toHaveLength(1)
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      document.dispatchEvent(esc)
    })
    expect(esc.defaultPrevented).toBe(true)
    expect(previews()).toHaveLength(0)

    act(() => cardLink(1).blur())
    act(() => cardLink(1).focus())
    expect(previews()).toHaveLength(1)
    act(() => stopPreview())
    expect(previews()).toHaveLength(0)
  })

  it('never starts with reduced motion', () => {
    mediaQueries(true)
    renderGrid()
    act(() => cardLink(0).focus())
    expect(previews()).toHaveLength(0)
  })
})
