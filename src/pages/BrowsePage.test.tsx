import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache, setPrefs } from '../lib/storage'
import BrowsePage from './BrowsePage'

setCatalog(fixtureVideos)

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
    // Frames run only when the test says so, so the first one after Back cannot slip by.
    const frames = new Map<number, FrameRequestCallback>()
    let ids = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++ids, callback)
      return ids
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const nextFrame = () => {
      const due = [...frames.values()]
      frames.clear()
      due.forEach((callback) => callback(performance.now()))
    }
    try {
      const router = renderHome()
      const strip = () => screen.queryByRole('region', { name: 'Recently viewed' })
      expect(strip()).not.toBeInTheDocument()

      await act(() => router.navigate('/watch/climate-basics'))
      localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
      resetStorageCache()
      await act(() => router.navigate(-1))

      // The restored scroll position belongs to the layout without the new strip.
      expect(strip()).not.toBeInTheDocument()
      act(nextFrame)
      expect(strip()).toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('caps the home at twelve collection rows of sixteen cards, then links to all', () => {
    const names = Array.from({ length: 14 }, (_, i) => `Subject ${String(i + 1).padStart(2, '0')}`)
    // Seventeen each (ties on date and size list them by name): a row keeps sixteen after
    // Featured and Also new take their newest.
    setCatalog(
      names.flatMap((name, i) => manyVideos(17, name).map((v) => ({ ...v, id: `s${i}-${v.id}` }))),
    )
    try {
      renderHome()
      // Plain DOM queries for the counts: a role query walks the whole page, slow on a busy machine.
      const headings = Array.from(document.querySelectorAll('section h2'), (h) => h.textContent)
      expect(names.filter((name) => headings.includes(name))).toEqual(names.slice(0, 12))
      // The first and the last row in full: pointing at a row renders all of it at once.
      for (const name of [names[0], names[11]]) {
        const region = screen.getByRole('region', { name })
        fireEvent.pointerEnter(region.querySelector('.row')!)
        expect(region.querySelectorAll('article')).toHaveLength(16)
        const tile = region.querySelector('li:last-child a')
        expect(tile).toHaveAccessibleName(`See all 17 videos in ${name}`)
        expect(tile).toHaveAttribute('href', `/collections/${name.toLowerCase().replace(' ', '-')}`)
      }
      const more = document.querySelector<HTMLElement>('section[aria-label="More collections"]')!
      expect(more).toHaveTextContent('2 more collections, plus everything in these.')
      expect(within(more).getByText('All 14 collections').closest('a')).toHaveAttribute(
        'href',
        '/collections',
      )
    } finally {
      setCatalog(fixtureVideos)
    }
  }, 20_000)

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

  it('shows each personal row as a carousel, behind its own privacy switch', async () => {
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    renderHome()
    // The recommender warms up in idle slices: allow for a busy machine.
    const because = await screen.findByRole(
      'region',
      { name: 'Because you watched “Climate Change Basics”' },
      { timeout: 5000 },
    )
    const recommended = await screen.findByRole(
      'region',
      { name: 'Recommended for you' },
      { timeout: 5000 },
    )
    for (const region of [
      because,
      recommended,
      screen.getByRole('region', { name: 'Recently viewed' }),
    ])
      expect(region.querySelector('[data-spatial="track"]')).not.toBeNull()
    act(() => setPrefs({ recommendations: false }))
    expect(screen.queryByRole('region', { name: 'Recommended for you' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /^Because you watched/ })).toBeInTheDocument()
    act(() => setPrefs({ recentlyViewed: false, becauseYouWatched: false }))
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Because you watched/ })).not.toBeInTheDocument()
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
