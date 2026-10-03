import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setFrameFlags } from '../data/frameFlags'
import { setCatalog } from '../data/testing'
import Featured from './Featured'
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

// Previews need stills; the third video has none and keeps its thumbnail.
const still = (n: number) => `https://i.ytimg.com/vi/abcdefghijk/maxres${n}.jpg`
const withStills = fixtureVideos
  .slice(0, 4)
  .map((v, i) => (i === 3 ? v : { ...v, frames: [still(1), still(2), still(3)] }))

// No hover unless asked (previews start from focus), reduced motion as given.
const mediaQueries = (reduce: boolean, hover = false) => {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes('reduce') ? reduce : hover && query.includes('hover'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}

function renderGrid(inDialog = false) {
  const grid = <VideoGrid videos={withStills} />
  const router = createMemoryRouter([
    { path: '/', element: inDialog ? <dialog open>{grid}</dialog> : grid },
    { path: '/watch/:id', element: <p>Player</p> },
  ])
  render(<RouterProvider router={router} />)
}

const previews = () => document.querySelectorAll('[data-preview]')
const cardLink = (i: number) => screen.getAllByRole('link', { name: /^Play / })[i]
const previewIn = (i: number) => cardLink(i).closest('article')!.querySelector('[data-preview]')

describe('card previews', () => {
  beforeEach(() => mediaQueries(false))

  it('never starts for a video whose every still is flagged (it would play on type alone)', () => {
    // Fixture videos share one YouTube id: flag the stills of a copy with its own.
    const flagged = { ...withStills[0], youtubeId: 'flaggedAll1' }
    setFrameFlags({ [flagged.youtubeId]: 0b1110 })
    try {
      const router = createMemoryRouter([
        { path: '/', element: <VideoGrid videos={[flagged, withStills[1]]} /> },
        { path: '/watch/:id', element: <p>Player</p> },
      ])
      render(<RouterProvider router={router} />)
      act(() => cardLink(0).focus())
      expect(previews()).toHaveLength(0)
      act(() => cardLink(1).focus())
      expect(previews()).toHaveLength(1)
    } finally {
      setFrameFlags({})
    }
  })

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

  it('starts on hover after a moment, but not inside an open dialog', () => {
    vi.useFakeTimers()
    try {
      mediaQueries(false, true)
      const hover = () => {
        fireEvent.pointerEnter(cardLink(0).closest('article')!, { pointerType: 'mouse' })
        act(() => vi.advanceTimersByTime(1000))
      }
      renderGrid()
      hover()
      expect(previews()).toHaveLength(1)
      act(() => stopPreview())
      cleanup()
      renderGrid(true)
      hover()
      expect(previews()).toHaveLength(0)
      // Keyboard focus still previews there.
      act(() => cardLink(1).focus())
      expect(previews()).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never starts for a video without stills', () => {
    renderGrid()
    act(() => cardLink(3).focus())
    expect(previews()).toHaveLength(0)
  })

  it('never starts with reduced motion', () => {
    mediaQueries(true)
    renderGrid()
    act(() => cardLink(0).focus())
    expect(previews()).toHaveLength(0)
  })
})

describe('featured viewer previews', () => {
  beforeEach(() => mediaQueries(false))

  function renderFeatured() {
    const router = createMemoryRouter([
      { path: '/', element: <Featured videos={withStills.slice(0, 3)} alsoNew={[]} start={0} /> },
      { path: '/watch/:id', element: <p>Player</p> },
    ])
    render(<RouterProvider router={router} />)
  }
  // The preview mounts inside the (decorative) featured image.
  const heroPreview = () => document.querySelector('a[aria-hidden="true"] [data-preview]')

  it('plays the shown video on keyboard focus in the viewer, and stops when focus leaves', () => {
    renderFeatured()
    expect(heroPreview()).toBeNull()
    act(() => screen.getByRole('link', { name: 'Play' }).focus())
    expect(heroPreview()).not.toBeNull()
    act(() => screen.getByRole('link', { name: 'Play' }).blur())
    expect(previews()).toHaveLength(0)
  })

  it('plays each video picked with previous / next', () => {
    renderFeatured()
    fireEvent.click(screen.getByRole('button', { name: 'Next featured video' }))
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(heroPreview()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous featured video' }))
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    expect(heroPreview()).not.toBeNull()
  })
})
