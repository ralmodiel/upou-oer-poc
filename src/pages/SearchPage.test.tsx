import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import SearchPage from './SearchPage'

vi.mock('../data/catalog.json', async () => ({
  default: (await import('../components/test-fixtures')).fixtureVideos,
}))

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/search', element: <SearchPage /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
}

describe('SearchPage', () => {
  it('shows matching titles for a query, keeping it in detail links', () => {
    renderAt('/search?q=climate')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “climate”')
    expect(screen.getByRole('status')).toHaveTextContent('2 titles')
    expect(screen.getByRole('link', { name: 'More info: Climate Change Basics' })).toHaveAttribute(
      'href',
      '/search?q=climate&v=climate-basics',
    )
    expect(screen.queryByRole('link', { name: 'Play Digital Art Studio' })).not.toBeInTheDocument()
  })

  it('suggests categories and topics for an empty query', () => {
    renderAt('/search')
    expect(screen.getByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Research' })).toHaveAttribute(
      'href',
      '/search?q=Research',
    )
    expect(screen.getByRole('link', { name: 'Climate' })).toBeInTheDocument()
  })

  it('shows a friendly message with suggestions when nothing matches', () => {
    renderAt('/search?q=zzzz')
    expect(screen.getByRole('heading', { name: 'Nothing matched your search' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Education' })).toBeInTheDocument()
  })
})
