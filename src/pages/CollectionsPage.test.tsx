import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import CategoryPage from './CategoryPage'
import CollectionsPage from './CollectionsPage'

// Width queries answer from `wide` (the hooks keep one MediaQueryList per query).
let wide = false
const baseMatchMedia = window.matchMedia
window.matchMedia = (query: string) => {
  const list = baseMatchMedia(query)
  return Object.defineProperty(list, 'matches', {
    get: () => wide && query.includes('min-width'),
  })
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/collections', element: <CollectionsPage /> },
      { path: '/collections/:slug', element: <CategoryPage /> },
      { path: '/watch/:id', element: <p>Player</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const playLinks = () =>
  screen.getAllByRole('link', { name: /^Play / }).map((l) => l.getAttribute('aria-label'))

describe('CollectionsPage', () => {
  beforeEach(() => setCatalog(fixtureVideos))
  afterEach(() => {
    wide = false
  })

  it('on phones lists every collection as a compact row: cover, name, count', () => {
    renderAt('/collections')
    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
    const research = screen.getByRole('link', { name: /^Research/ })
    expect(research).toHaveAttribute('href', '/collections/research')
    expect(research).toHaveTextContent('3 videos')
    expect(research.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('climate-basics'),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('from md up shows mosaic cards with cover, count and sample titles', () => {
    wide = true
    renderAt('/collections')
    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(3)
    const research = cards.find((c) => within(c).queryByRole('link', { name: 'Research' }))!
    expect(within(research).getByRole('link', { name: 'Research' })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    expect(research).toHaveTextContent('3 videos')
    expect(research).toHaveTextContent('Climate Change Basics')
    // A mosaic of the three newest stills, the newest first and largest.
    const tiles = research.querySelectorAll('img')
    expect(tiles).toHaveLength(3)
    expect(tiles[0]).toHaveAttribute('src', expect.stringContaining('climate-basics'))
  })
})

describe('CategoryPage', () => {
  beforeEach(() => setCatalog(fixtureVideos))

  it('shows the collection newest first with breadcrumbs and a count', () => {
    renderAt('/collections/research')
    expect(screen.getByRole('heading', { level: 1, name: 'Research' })).toBeInTheDocument()
    expect(screen.getByText('Collection')).toBeInTheDocument()
    expect(screen.getByText('3 videos')).toBeInTheDocument()
    // The decorative strip of its newest stills beside the band.
    expect(document.querySelectorAll('[aria-hidden="true"] img')).toHaveLength(3)
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'Collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
    expect(playLinks()).toEqual([
      'Play Climate Change Basics',
      'Play Climate Policy in the Philippines',
      'Play Ocean Science 101',
    ])
    expect(screen.getByRole('link', { name: 'Newest' })).toHaveAttribute('aria-current', 'true')
  })

  it('sorts by ?sort= and the sort links reflect it', async () => {
    const router = renderAt('/collections/research?sort=title')
    expect(playLinks()).toEqual([
      'Play Climate Change Basics',
      'Play Climate Policy in the Philippines',
      'Play Ocean Science 101',
    ])
    expect(screen.getByRole('link', { name: 'A–Z' })).toHaveAttribute('aria-current', 'true')
    await userEvent.click(screen.getByRole('link', { name: 'Oldest' }))
    expect(router.state.location.search).toBe('?sort=oldest')
    expect(playLinks()[0]).toBe('Play Ocean Science 101')
    await userEvent.click(screen.getByRole('link', { name: 'Newest' }))
    expect(router.state.location.search).toBe('')
  })

  it('shows the shared not-found page for an unknown slug', () => {
    renderAt('/collections/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Collection not found' }))
    expect(screen.getByText('Not found', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/')
  })
})

describe('CategoryPage paging', () => {
  beforeEach(() => setCatalog(manyVideos(30)))

  it('shows 24 videos, then loads the rest and focuses the first new card', async () => {
    renderAt('/collections/research')
    expect(playLinks()).toHaveLength(24)
    expect(screen.getByRole('status')).toHaveTextContent('Showing 24 of 30')
    await userEvent.click(screen.getByRole('button', { name: 'Load 6 more' }))
    expect(playLinks()).toHaveLength(30)
    expect(screen.getByRole('link', { name: 'Play Lecture 25' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: /Load/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Showing 30 of 30')
  })
})
