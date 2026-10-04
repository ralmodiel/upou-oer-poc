import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../../data/testing'
import { warmRecommender } from '../../lib/recommend'
import WatchPage from '../../pages/WatchPage'
import { testVideo } from '../reel/testing'
import { moreUpNext } from './recommendations'
import { REVEAL_WAIT_MS } from './UpNext'

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
    expect(rows()).toHaveLength(9)
    expect(moreUpNext).not.toHaveBeenCalled()

    const more = screen.getByRole('button', { name: 'More…' })
    act(() => more.focus())
    expect(moreUpNext).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(moreUpNext).toHaveBeenCalledTimes(1)

    // The click uses what idle time worked out.
    fireEvent.click(more)
    expect(rows()).toHaveLength(17)
    expect(moreUpNext).toHaveBeenCalledTimes(1)
    expect(rows()[9]).toHaveFocus()
  })

  it('with nothing left to add, More… goes and the last row keeps focus in the list', () => {
    setCatalog([testVideo, ...lookalikes(8)])
    warmRecommender()
    renderWatch()
    expect(rows()).toHaveLength(9)
    const more = screen.getByRole('button', { name: 'More…' })
    act(() => more.focus())
    fireEvent.click(more)
    expect(rows()).toHaveLength(9)
    expect(screen.queryByRole('button', { name: 'More…' })).not.toBeInTheDocument()
    expect(rows()[8]).toHaveFocus()
  })
})

describe('Up next as it shows', () => {
  afterEach(() => vi.useRealTimers())
  const list = () => screen.getByRole('list', { name: 'Up next' })

  it('shows at once when the picks are ready on the first render', () => {
    setCatalog([testVideo, ...lookalikes(12)])
    warmRecommender()
    renderWatch()
    expect(list()).toHaveAttribute('data-ready')
  })

  it('waits unseen for the picks, and shows the stand-ins if they take too long', async () => {
    vi.useFakeTimers()
    setCatalog([testVideo, ...lookalikes(12)])
    renderWatch()
    // The stand-ins hold the rows' space, unseen, while the recommender's index builds.
    expect(rows().length).toBeGreaterThan(0)
    expect(list()).toHaveAttribute('data-entrance')
    expect(list()).not.toHaveAttribute('data-ready')
    await act(() => vi.advanceTimersByTimeAsync(REVEAL_WAIT_MS))
    expect(list()).toHaveAttribute('data-ready')
  })
})

describe('Up next and the row now playing', () => {
  const observed = new Map<Element, () => void>()
  beforeEach(() => {
    observed.clear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        callback: () => void
        constructor(callback: () => void) {
          this.callback = callback
        }
        observe(el: Element) {
          observed.set(el, this.callback)
        }
        unobserve() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps it centred in the list when the list settles late, until the viewer scrolls', () => {
    const picks = lookalikes(12)
    setCatalog([testVideo, ...picks])
    const ids = picks.map((v) => v.id)
    const router = createMemoryRouter([{ path: '/watch/:id', Component: WatchPage }], {
      initialEntries: [
        { pathname: '/watch/pick-6', state: { playlist: { from: testVideo.id, ids } } },
      ],
    })
    render(<RouterProvider router={router} />)
    const ol = screen.getByRole('list', { name: 'Up next' })
    const row = within(ol)
      .getAllByRole('link')
      .find((link) => link.getAttribute('aria-current') === 'true')!
    expect(row).toHaveTextContent('Similar video 6')
    // A whole page load, on a playlist page too, plays the list's entrance.
    expect(ol).toHaveAttribute('data-entrance')

    // Layout, which jsdom lacks: the row 630px down the list, which is first 0px tall, then 300px.
    let height = 0
    let top = 0
    row.getBoundingClientRect = () => ({ top: 630 - top, height: 105 }) as DOMRect
    Object.defineProperties(ol, {
      clientHeight: { get: () => height },
      scrollHeight: { get: () => 1260 },
      scrollTop: { get: () => top, set: (v: number) => (top = v) },
    })
    ol.scrollTo = ((options: ScrollToOptions) => (top = options.top ?? top)) as typeof ol.scrollTo
    height = 300
    act(() => observed.get(ol)?.())
    expect(top).toBe(630 - (300 - 105) / 2)

    // The viewer scrolls the list: it is theirs from then on.
    fireEvent.wheel(ol)
    height = 500
    act(() => observed.get(ol)?.())
    expect(top).toBe(630 - (300 - 105) / 2)

    // A row chosen in the list: the next page keeps the list as it is, with no entrance.
    fireEvent.click(within(ol).getByText('Similar video 8'))
    const next = screen.getByRole('list', { name: 'Up next' })
    expect(within(next).getByRole('link', { current: true })).toHaveTextContent('Similar video 8')
    expect(next).not.toHaveAttribute('data-entrance')
  })
})

describe('More… at the end of Up next', () => {
  it('gives one cue when the viewer scrolls to the end, again only after scrolling back up', () => {
    setCatalog([testVideo, ...lookalikes(30)])
    warmRecommender()
    renderWatch()
    const ol = screen.getByRole('list', { name: 'Up next' })
    const more = screen.getByRole('button', { name: 'More…' })
    // Layout, which jsdom lacks: 900px of rows in a 400px list.
    let top = 0
    Object.defineProperties(ol, {
      clientHeight: { get: () => 400 },
      scrollHeight: { get: () => 900 },
      scrollTop: { get: () => top, set: (v: number) => (top = v) },
    })
    const scrollTo = (to: number) => {
      top = to
      fireEvent.scroll(ol)
    }
    // A scroll the page made (centring the row now playing) gives no cue.
    scrollTo(500)
    expect(more).not.toHaveAttribute('data-nudge')
    scrollTo(0)

    fireEvent.wheel(ol)
    scrollTo(300)
    expect(more).not.toHaveAttribute('data-nudge')
    scrollTo(500)
    expect(more).toHaveAttribute('data-nudge', 'a')
    // Staying at the end, or nearly scrolling back, gives no second cue.
    scrollTo(490)
    scrollTo(500)
    expect(more).toHaveAttribute('data-nudge', 'a')
    // Back up, then down again: a new cue.
    scrollTo(200)
    scrollTo(500)
    expect(more).toHaveAttribute('data-nudge', 'b')
  })
})
