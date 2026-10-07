import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { setCatalog } from '../data/testing'
import { testVideo } from '../features/reel/testing'
import { resetStorageCache } from '../lib/storage'
import WatchPage from './WatchPage'

// An engine without container queries (old TVs) skips the reel: the player is there at once.
vi.mock('../lib/lite', () => ({ lite: false, reelWorks: false }))

beforeEach(() => {
  localStorage.clear()
  resetStorageCache()
  setCatalog([testVideo])
})

it('without the reel, opening the player still records the video in watch history', () => {
  const router = createMemoryRouter([{ path: '/watch/:id', Component: WatchPage }], {
    initialEntries: [`/watch/${testVideo.id}`],
  })
  render(<RouterProvider router={router} />)

  expect(screen.getByRole('region', { name: 'Video player' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('upou:history') ?? '[]')[0]?.id).toBe(testVideo.id)
})
