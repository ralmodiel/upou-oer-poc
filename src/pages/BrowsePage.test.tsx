import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache, setPrefs } from '../lib/storage'
import BrowsePage from './BrowsePage'

setCatalog(fixtureVideos)

// `n` videos in one collection, a day apart and newest first from `from` (ids prefixed by name).
const collection = (name: string, n: number, from = Date.UTC(2026, 0, 1)) =>
  manyVideos(n, name).map((v, i) => ({
    ...v,
    id: `${name.toLowerCase().replace(/\W+/g, '-')}-${v.id}`,
    publishedAt: new Date(from - i * 86_400_000).toISOString(),
  }))

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
    setCatalog([...fixtureVideos, ...collection('Research', 12)])
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
      // Below the fold on a first visit, the sections render just after the first paint.
      const research = await screen.findByRole('region', { name: 'Research' })
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
      // The first page (and the card after it) first.
      expect((await within(research).findAllByRole('article')).length).toBeGreaterThanOrEqual(5)
    } finally {
      vi.unstubAllGlobals()
      setCatalog(fixtureVideos)
    }
  })

  it('gives a row only to collections that fill three pages, newest first', () => {
    // Small Subject has the newest videos but only four; Research, Arts and Education (fixtures)
    // are small too. Featured takes Small Subject's four, Also new Alpha's newest four.
    setCatalog([
      ...fixtureVideos,
      ...collection('Small Subject', 4, Date.UTC(2027, 0, 1)),
      ...collection('Alpha Studies', 14, Date.UTC(2026, 11, 1)),
      ...collection('Gamma Studies', 12, Date.UTC(2026, 8, 1)),
      ...collection('Beta Studies', 20),
    ])
    try {
      renderHome()
      expect(screen.getByRole('region', { name: 'Featured' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Collections' })).toBeInTheDocument()
      const headings = Array.from(document.querySelectorAll('section h2'), (h) => h.textContent)
      const rows = ['Alpha Studies', 'Gamma Studies', 'Beta Studies']
      expect(headings.filter((h) => h?.endsWith('Studies') || h === 'Small Subject')).toEqual(rows)
      for (const name of ['Small Subject', 'Research', 'Arts and Multimedia', 'Education'])
        expect(screen.queryByRole('region', { name })).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument()
      const alpha = screen.getByRole('region', { name: 'Alpha Studies' })
      expect(
        within(alpha).getByRole('link', { name: 'See all (14) in Alpha Studies' }),
      ).toHaveAttribute('href', '/collections/alpha-studies')
      expect(document.querySelector('section[aria-label="More collections"]')).toHaveTextContent(
        '4 more collections',
      )
    } finally {
      setCatalog(fixtureVideos)
    }
  }, 20_000)

  it('fills each row to at least twelve cards, ending on See all only when there is more', () => {
    setCatalog([
      ...fixtureVideos,
      ...collection('Small Subject', 4, Date.UTC(2027, 0, 1)),
      ...collection('Alpha Studies', 14, Date.UTC(2026, 11, 1)),
      ...collection('Gamma Studies', 12, Date.UTC(2026, 8, 1)),
      ...collection('Beta Studies', 20),
    ])
    try {
      renderHome()
      // Plain DOM queries: a role query walks the whole page, slow on a busy machine.
      const row = (name: string) => {
        const region = Array.from(document.querySelectorAll('section')).find(
          (s) => s.querySelector('h2')?.textContent === name,
        )!
        // Pointing at a row renders all of it at once.
        fireEvent.pointerEnter(region.querySelector('.row')!)
        const cards = Array.from(region.querySelectorAll('article'))
        const titles = cards.map((c) => c.querySelector('[data-card-link]')!.textContent)
        return { cards: cards.length, titles, tile: region.querySelector('li:last-child > a') }
      }
      // Alpha's four newest are in Also new: two of them top its ten others up to twelve, in date
      // order; it holds more than that, so See all ends the row.
      const alpha = row('Alpha Studies')
      expect(alpha.cards).toBe(12)
      expect(alpha.titles.slice(0, 3)).toEqual(['Lecture 01', 'Lecture 02', 'Lecture 05'])
      expect(alpha.tile).toHaveAccessibleName('See all 14 videos in Alpha Studies')
      // Twelve videos, all in the row: no tile, the last card ends it.
      const gamma = row('Gamma Studies')
      expect(gamma.cards).toBe(12)
      expect(gamma.tile).toBeNull()
      const beta = row('Beta Studies')
      expect(beta.cards).toBe(16)
      expect(beta.tile).toHaveAccessibleName('See all 20 videos in Beta Studies')
      expect(beta.tile).toHaveAttribute('href', '/collections/beta-studies')
    } finally {
      setCatalog(fixtureVideos)
    }
  }, 20_000)

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

  it('puts the Featured row first under the hero, then Also new, with or without history', async () => {
    const rowNames = () =>
      [...document.querySelectorAll('main section, section')]
        .filter((sec) => sec.querySelector(':scope [data-row], :scope [aria-busy]'))
        .map((sec) => sec.getAttribute('aria-label') ?? sec.querySelector('h2')?.textContent)
    const { unmount } = render(
      <RouterProvider router={createMemoryRouter([{ path: '/', Component: BrowsePage }])} />,
    )
    expect(rowNames().slice(0, 2)).toEqual(['Featured videos', 'Also new'])
    unmount()
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    renderHome()
    await screen.findByRole('region', { name: 'Recently viewed' })
    const names = rowNames()
    expect(names.slice(0, 2)).toEqual(['Featured videos', 'Also new'])
    expect(names).toContain('Recently viewed')
  })
})
