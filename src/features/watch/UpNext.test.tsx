import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../../data/testing'
import { warmRecommender } from '../../lib/recommend'
import WatchPage from '../../pages/WatchPage'
import { testVideo } from '../reel/testing'
import { moreUpNext } from './recommendations'

vi.mock('./recommendations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./recommendations')>()
  return { ...actual, moreUpNext: vi.fn(actual.moreUpNext) }
})

const lookalikes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    ...testVideo,
    id: `pick-${i}`,
    youtubeId: `pick${i}`.padEnd(11, 'x'),
    title: `Similar video ${i}`,
  }))

function renderWatch() {
  const router = createMemoryRouter([{ path: '/watch/:id', Component: WatchPage }], {
    initialEntries: [`/watch/${testVideo.id}`],
  })
  render(<RouterProvider router={router} />)
}
const rows = () => within(screen.getByRole('list', { name: 'Up next' })).getAllByRole('link')

describe('Up next More…', () => {
  // A block: a function returned from beforeEach would be called as its teardown.
  beforeEach(() => {
    vi.mocked(moreUpNext).mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('works out the next picks only when wanted, ahead of time once More… has focus', async () => {
    setCatalog([testVideo, ...lookalikes(30)])
    warmRecommender()
    vi.useFakeTimers()
    renderWatch()
    // Not while the page renders: that is a larger recommender run than the list's own.
    expect(rows()).toHaveLength(8)
    expect(moreUpNext).not.toHaveBeenCalled()

    const more = screen.getByRole('button', { name: 'More…' })
    act(() => more.focus())
    expect(moreUpNext).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(moreUpNext).toHaveBeenCalledTimes(1)

    // The click uses what idle time worked out.
    fireEvent.click(more)
    expect(rows()).toHaveLength(16)
    expect(moreUpNext).toHaveBeenCalledTimes(1)
    expect(rows()[8]).toHaveFocus()
  })

  it('with nothing left to add, More… goes and the last row keeps focus in the list', () => {
    setCatalog([testVideo, ...lookalikes(8)])
    warmRecommender()
    renderWatch()
    expect(rows()).toHaveLength(8)
    const more = screen.getByRole('button', { name: 'More…' })
    act(() => more.focus())
    fireEvent.click(more)
    expect(rows()).toHaveLength(8)
    expect(screen.queryByRole('button', { name: 'More…' })).not.toBeInTheDocument()
    expect(rows()[7]).toHaveFocus()
  })
})
