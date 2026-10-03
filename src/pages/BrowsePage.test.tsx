import { act, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fixtureVideos } from '../components/test-fixtures'
import { setCatalog } from '../data/testing'
import { resetStorageCache } from '../lib/storage'
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
    expect(screen.queryByRole('region', { name: 'Continue watching' })).not.toBeInTheDocument()
  })

  it('keeps the old layout for one frame after Back from the player, then adds the strip', async () => {
    const router = renderHome()
    const strip = () => screen.queryByRole('region', { name: 'Continue watching' })
    expect(strip()).not.toBeInTheDocument()

    await act(() => router.navigate('/watch/climate-basics'))
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    await act(() => router.navigate(-1))

    // The restored scroll position belongs to the layout without the new strip.
    expect(strip()).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Continue watching' })).toBeInTheDocument()
  })
})
