import { act, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache, setPrefs } from '../lib/storage'
import BrowsePage from './BrowsePage'

setCatalog(fixtureVideos)

// Width queries answer from `wide` (the hooks keep one MediaQueryList per query).
let wide = false
const baseMatchMedia = window.matchMedia
window.matchMedia = (query: string) =>
  Object.defineProperty(baseMatchMedia(query), 'matches', {
    get: () => wide && query.includes('min-width'),
  })

function renderHome() {
  const router = createMemoryRouter([
    { path: '/', Component: BrowsePage },
    { path: '/collections/:slug', element: <p>Collection</p> },
    { path: '/watch/:id', element: <p>Player</p> },
  ])
  render(<RouterProvider router={router} />)
  return router
}

describe('BrowsePage', () => {
  it('on a fresh visit renders section cards only as the section nears the viewport', async () => {
    const watched: { cb: IntersectionObserverCallback; el?: Element }[] = []
    class FakeObserver {
      entry: { cb: IntersectionObserverCallback; el?: Element }
      constructor(cb: IntersectionObserverCallback) {
        this.entry = { cb }
        watched.push(this.entry)
      }
      observe(el: Element) {
        this.entry.el = el
      }
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    try {
      const router = createMemoryRouter(
        [
          { path: '/', Component: BrowsePage },
          { path: '/about', element: <p>About</p> },
        ],
        { initialEntries: ['/about'] },
      )
      render(<RouterProvider router={router} />)
      await act(() => router.navigate('/'))
      const research = screen.getByRole('region', { name: 'Research' })
      // Heading and See all are there at once; the cards wait (a same-size skeleton holds the place).
      expect(within(research).getByRole('link', { name: /^See all/ })).toBeInTheDocument()
      expect(within(research).queryAllByRole('article')).toHaveLength(0)
      const near = watched.find((w) => w.el === research)!
      act(() =>
        near.cb(
          [{ isIntersecting: true, target: research } as unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        ),
      )
      expect(await within(research).findAllByRole('article')).toHaveLength(3)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('opens with the featured block, the collection chips and one grid section per category', () => {
    renderHome()
    expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Collections' })).toBeInTheDocument()
    const research = screen.getByRole('region', { name: 'Research' })
    expect(within(research).getAllByRole('article')).toHaveLength(3)
    expect(within(research).getByRole('link', { name: 'See all (3) in Research' })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    expect(screen.getByRole('region', { name: 'Arts and Multimedia' })).toBeInTheDocument()
    // Fewer than three videos: no section.
    expect(screen.queryByRole('region', { name: 'Education' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument()
  })

  it('keeps the old layout for one frame after Back from the player, then adds the strip', async () => {
    const router = renderHome()
    const strip = () => screen.queryByRole('region', { name: 'Recently viewed' })
    expect(strip()).not.toBeInTheDocument()

    await act(() => router.navigate('/watch/climate-basics'))
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    await act(() => router.navigate(-1))

    // The restored scroll position belongs to the layout without the new strip.
    expect(strip()).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Recently viewed' })).toBeInTheDocument()
  })

  it('caps the home at twelve collections, one row each on wide screens, then links to all', () => {
    const names = Array.from({ length: 20 }, (_, i) => `Subject ${String(i + 1).padStart(2, '0')}`)
    wide = true
    setCatalog(
      names.flatMap((name, i) =>
        manyVideos(30 - i, name).map((v) => ({ ...v, id: `s${i}-${v.id}` })),
      ),
    )
    try {
      renderHome()
      const shown = names.filter((name) => screen.queryByRole('region', { name }))
      expect(shown).toEqual(names.slice(0, 12))
      for (const name of shown) {
        expect(within(screen.getByRole('region', { name })).getAllByRole('article')).toHaveLength(4)
      }
      expect(screen.getByText('8 more collections, plus everything in these.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'All 20 collections' })).toHaveAttribute(
        'href',
        '/collections',
      )
    } finally {
      wide = false
      setCatalog(fixtureVideos)
    }
  })

  // Last: it leaves watch history in this module's "last shown" memory, which the Back test above
  // must not inherit.
  it('recommends unwatched titles for a profile, with a reason on each card', async () => {
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    localStorage.setItem('upou:searches', JSON.stringify([{ q: 'art', at: 1 }]))
    resetStorageCache()
    renderHome()
    const section = await screen.findByRole('region', { name: 'Recommended for you' })
    const cards = await within(section).findAllByRole('article')
    const titles = cards.map((c) => within(c).getByRole('link', { name: /^Play / }).textContent)
    expect(titles).not.toContain('Climate Change Basics')
    expect(
      within(cards[0]).getByText(
        /^(Because you|Based on|Picked for you|More from|From the same|Also in|Related video)/,
      ),
    ).toBeInTheDocument()
    const because = await screen.findByRole('region', {
      name: 'Because you watched “Climate Change Basics”',
    })
    expect(within(because).getAllByRole('article').length).toBeGreaterThan(0)
  })

  it('drops every history-based row at once when watch history is switched off', async () => {
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    renderHome()
    await screen.findByRole('region', { name: 'Because you watched “Climate Change Basics”' })
    expect(screen.getByRole('region', { name: 'Recently viewed' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Recommended for you' })).toBeInTheDocument()
    act(() => setPrefs({ history: false }))
    expect(localStorage.getItem('upou:history')).toBe('[]')
    expect(screen.queryByRole('region', { name: /^Because you watched/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument()
    // Nothing else is known about this viewer: no picks either.
    expect(screen.queryByRole('region', { name: 'Recommended for you' })).not.toBeInTheDocument()
  })
})
