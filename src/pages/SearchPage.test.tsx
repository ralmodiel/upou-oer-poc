import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
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
    expect(within(filters).getByRole('link', { name: /^All ?3$/ })).toHaveAttribute('aria-current')
    expect(within(filters).getByRole('link', { name: /^Research ?2$/ })).toHaveAttribute(
      'href',
      '/search?q=science&category=research',
    )
    expect(within(filters).getByRole('link', { name: /^Education ?1$/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows only the chosen collection when ?category= is set', () => {
    renderAt('/search?q=science&category=education')
    expect(screen.getByRole('status')).toHaveTextContent('1 video in Education')
    expect(screen.getByRole('link', { name: 'Play The Science of Learning' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Play Ocean Science 101' })).not.toBeInTheDocument()
    const filters = screen.getByRole('navigation', { name: 'Filter by collection' })
    expect(within(filters).getByRole('link', { name: /^Education ?1$/ })).toHaveAttribute(
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
    expect(screen.getByRole('link', { name: /^Research ?3$/ })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search videos' }), 'ocean{Enter}')
    expect(router.state.location.search).toBe('?q=ocean')
    expect(screen.getByRole('status')).toHaveTextContent('1 video')
  })

  it('shows a friendly message with suggestions when nothing matches', () => {
    renderAt('/search?q=zzzz')
    expect(screen.getByRole('heading', { name: 'Nothing matched' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Education ?2$/ })).toBeInTheDocument()
  })
})
