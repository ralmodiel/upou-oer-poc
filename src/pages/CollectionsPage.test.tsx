import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import CategoryPage from './CategoryPage'
import CollectionsPage from './CollectionsPage'

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

  it('lists every collection with cover, count and sample titles', () => {
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
    expect(research.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('climate-basics'),
    )
  })
})

describe('CategoryPage', () => {
  beforeEach(() => setCatalog(fixtureVideos))

  it('shows the collection newest first with breadcrumbs and a count', () => {
    renderAt('/collections/research')
    expect(screen.getByRole('heading', { level: 1, name: 'Research' })).toBeInTheDocument()
    expect(screen.getByText('3 videos')).toBeInTheDocument()
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

  it('shows a not-found state for an unknown slug', () => {
    renderAt('/collections/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Collection not found' }))
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
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
