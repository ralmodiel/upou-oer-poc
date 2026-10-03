import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fixtureVideos, manyVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import SearchPage from './SearchPage'

setCatalog(fixtureVideos)

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/search', element: <SearchPage /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
  return router
}

// Ten collections of "Lecture" videos, the first with the most.
const tenCollections = Array.from({ length: 10 }, (_, i) =>
  manyVideos(i === 0 ? 3 : 1, `Subject ${String(i + 1).padStart(2, '0')}`).map((v) => ({
    ...v,
    id: `${v.id}-s${i}`,
  })),
).flat()

describe('SearchPage filter chips', () => {
  it('shows the biggest collections first and the rest behind a toggle', async () => {
    setCatalog(tenCollections)
    renderAt('/search?q=lecture')
    const filters = screen.getByRole('navigation', { name: 'Filter by collection' })
    // "All" plus seven collections, then the toggle.
    expect(within(filters).getAllByRole('link')).toHaveLength(8)
    const toggle = within(filters).getByRole('button', { name: 'All 10 collections' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggle)
    expect(within(filters).getAllByRole('link')).toHaveLength(11)
    expect(within(filters).getByRole('button', { name: 'Fewer collections' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    cleanup()
    setCatalog(fixtureVideos)
  })

  it('always shows the active collection', () => {
    setCatalog(tenCollections)
    renderAt('/search?q=lecture&category=subject-10')
    const filters = screen.getByRole('navigation', { name: 'Filter by collection' })
    expect(within(filters).getByRole('link', { name: 'Subject 10 (1)' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    cleanup()
    setCatalog(fixtureVideos)
  })
})

describe('SearchPage', () => {
  it('shows matching titles for a query, keeping it in detail links', () => {
    renderAt('/search?q=climate')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “climate”')
    expect(screen.getByRole('status')).toHaveTextContent('2 videos')
    expect(screen.getByRole('link', { name: 'Details: Climate Change Basics' })).toHaveAttribute(
      'href',
      '/search?q=climate&v=climate-basics',
    )
    expect(screen.queryByRole('link', { name: 'Play Digital Art Studio' })).not.toBeInTheDocument()
  })

  it('filters by collection with chips that reflect ?category=', () => {
    renderAt('/search?q=science')
    const filters = screen.getByRole('navigation', { name: 'Filter by collection' })
    expect(within(filters).getByRole('link', { name: /^All \(3\)$/ })).toHaveAttribute(
      'aria-current',
    )
    expect(within(filters).getByRole('link', { name: /^Research \(2\)$/ })).toHaveAttribute(
      'href',
      '/search?q=science&category=research',
    )
    expect(within(filters).getByRole('link', { name: /^Education \(1\)$/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows only the chosen collection when ?category= is set', () => {
    renderAt('/search?q=science&category=education')
    expect(screen.getByRole('status')).toHaveTextContent('1 video in Education')
    expect(screen.getByRole('link', { name: 'Play The Science of Learning' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Play Ocean Science 101' })).not.toBeInTheDocument()
    const filters = screen.getByRole('navigation', { name: 'Filter by collection' })
    expect(within(filters).getByRole('link', { name: /^Education \(1\)$/ })).toHaveAttribute(
      'aria-current',
    )
    expect(screen.getByRole('link', { name: 'Details: The Science of Learning' })).toHaveAttribute(
      'href',
      '/search?q=science&category=education&v=learning-science',
    )
  })

  it('suggests topics and collections for an empty query, and searches on submit', async () => {
    const router = renderAt('/search')
    expect(screen.getByRole('heading', { level: 1, name: 'Search every video' }))
    expect(screen.getByRole('link', { name: 'Climate' })).toHaveAttribute(
      'href',
      '/search?q=Climate',
    )
    expect(screen.getByRole('link', { name: /^Research \(3\)$/ })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search videos' }), 'ocean{Enter}')
    expect(router.state.location.search).toBe('?q=ocean')
    expect(screen.getByRole('status')).toHaveTextContent('1 video')
  })

  it('records a query once it rests, and at once when a collection filter is chosen', async () => {
    const recorded = () =>
      (JSON.parse(localStorage.getItem('upou:searches') ?? '[]') as { q: string }[]).map((e) => e.q)
    renderAt('/search?q=ocean')
    expect(recorded()).toEqual([])
    await waitFor(() => expect(recorded()).toEqual(['ocean']), { timeout: 2500 })
    cleanup()
    renderAt('/search?q=science&category=research')
    expect(recorded()).toEqual(['science', 'ocean'])
  })

  it('shows a friendly message with suggestions when nothing matches', () => {
    renderAt('/search?q=zzzz')
    expect(screen.getByRole('heading', { name: 'Nothing matched' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Education \(2\)$/ })).toBeInTheDocument()
  })
})
