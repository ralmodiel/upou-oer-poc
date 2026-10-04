import { render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, it } from 'vitest'
import { setCatalog } from '../data/testing'
import DetailModal from './DetailModal'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

it('opens on the still, which plays and grows while focused, with ↓ leading to Play', async () => {
  const router = createMemoryRouter([{ path: '/', element: <DetailModal /> }], {
    initialEntries: ['/?v=climate-basics'],
  })
  render(<RouterProvider router={router} />)
  const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
  const still = within(dialog).getByRole('link', { name: 'Play Climate Change Basics' })
  await waitFor(() => expect(still).toHaveFocus())
  expect(still).toHaveAttribute('href', '/watch/climate-basics')
  // The growth hangs off the wrapper (a focused link drops its transition in index.css).
  expect(still.parentElement?.className).toContain('has-[a:focus]:scale-108')
  expect(still).toHaveAttribute('data-spatial', 'over-entry')
  expect(within(dialog).getByRole('link', { name: 'Play' })).toHaveAttribute(
    'data-spatial',
    'entry',
  )
})
