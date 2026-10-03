import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache } from '../lib/storage'
import MyListPage from './MyListPage'

setCatalog(fixtureVideos)

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <MyListPage /> }])
  render(<RouterProvider router={router} />)
}

describe('MyListPage', () => {
  it('explains how to save and links to Collections when empty', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
  })

  it('shows saved videos in saved order', () => {
    localStorage.setItem('upou:my-list', JSON.stringify(['ocean-science', 'digital-art', 'gone']))
    resetStorageCache()
    renderPage()
    expect(screen.getByText(/2 saved videos/)).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: /^Play / })
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/watch/ocean-science',
      '/watch/digital-art',
    ])
  })
})
