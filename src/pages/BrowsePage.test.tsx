import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { resetStorageCache } from '../lib/storage'
import BrowsePage from './BrowsePage'

vi.mock('../data/catalog.json', async () => ({
  default: (await import('../components/test-fixtures')).fixtureVideos,
}))

describe('BrowsePage', () => {
  it('keeps the old layout for one frame after Back from the player, then adds the new row', async () => {
    const router = createMemoryRouter([
      { path: '/', Component: BrowsePage },
      { path: '/watch/:id', element: <p>Player</p> },
    ])
    render(<RouterProvider router={router} />)
    const recent = () => screen.queryByRole('region', { name: 'Recently Watched' })
    expect(recent()).not.toBeInTheDocument()

    await act(() => router.navigate('/watch/climate-basics'))
    localStorage.setItem('upou:history', JSON.stringify([{ id: 'climate-basics', at: 1 }]))
    resetStorageCache()
    await act(() => router.navigate(-1))

    // The restored scroll position belongs to the layout without the new row.
    expect(recent()).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'Recently Watched' })).toBeInTheDocument()
  })
})
