import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { getRows } from '../data/catalog'
import { setCatalog } from '../data/testing'
import Recommended from './Recommended'
import RecentlyViewed from './RecentlyViewed'
import Section from './Section'
import { manyVideos } from './test-fixtures'

const lectures = manyVideos(30)
setCatalog(lectures)

function renderAt(element: ReactNode) {
  const router = createMemoryRouter([
    { path: '/', element },
    { path: '/collections/:slug', element: <p>Collection</p> },
    { path: '/watch/:id', element: <p>Player</p> },
  ])
  render(<RouterProvider router={router} />)
}

// jsdom has no layout: give the track a 1000px view, items every 250px (four to a page) and a
// scroll position that scrollBy moves; scroll events re-measure on the next frame.
function layOut(region: HTMLElement) {
  const track = region.querySelector<HTMLElement>('[data-spatial="track"]')!
  const items = Array.from(track.firstElementChild!.children)
  let x = 0
  items.forEach((item, i) => {
    item.getBoundingClientRect = () => ({ left: i * 250 - x, width: 234 }) as DOMRect
  })
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: 1000 },
    scrollWidth: { configurable: true, value: items.length * 250 },
    scrollLeft: { configurable: true, get: () => x },
  })
  const max = items.length * 250 - 1000
  const scrollBy = vi.fn(({ left = 0 }: ScrollToOptions) => {
    x = Math.min(max, Math.max(0, x + left))
    track.dispatchEvent(new Event('scroll'))
  })
  track.scrollBy = scrollBy as typeof track.scrollBy
  const scrollTo = async (left: number) => {
    x = left
    track.dispatchEvent(new Event('scroll'))
    await frame()
  }
  return { scrollBy, scrollTo }
}

const frame = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))))

// A hidden button has no accessible name to query by role; its label still finds it.
const button = (name: string) => screen.getByLabelText(name, { selector: 'button' })

// A row renders its first page (and the card peeking after it) at once, the rest when used or idle:
// pointing at it renders all of it.
function renderRow() {
  renderAt(<Section row={getRows(16)[0]} />)
  const region = screen.getByRole('region', { name: 'Research' })
  fireEvent.pointerEnter(region.querySelector('.row')!)
  return region
}

describe('Collection rows', () => {
  it('hold up to sixteen cards, then a See all tile for the whole collection', async () => {
    renderAt(<Section row={getRows(16)[0]} />)
    const region = screen.getByRole('region', { name: 'Research' })
    // The first page and the card after it come first; the rest once the browser is idle.
    expect(within(region).getAllByRole('article')).toHaveLength(5)
    await waitFor(() => expect(within(region).getAllByRole('article')).toHaveLength(16), {
      timeout: 5000,
    })
    const items = within(region).getAllByRole('listitem')
    expect(items).toHaveLength(17)
    expect(within(items[16]).getByRole('link')).toHaveAccessibleName(
      'See all 30 videos in Research',
    )
    expect(within(items[16]).getByRole('link')).toHaveAttribute('href', '/collections/research')
    // The tile is a roving item like the cards: out of the Tab order until reached.
    expect(within(items[16]).getByRole('link')).toHaveAttribute('tabindex', '-1')
  })

  it('render the rest at once when hovered or focused', () => {
    renderAt(<Section row={getRows(16)[0]} />)
    const region = screen.getByRole('region', { name: 'Research' })
    fireEvent.pointerEnter(region.querySelector('.row')!)
    expect(within(region).getAllByRole('listitem')).toHaveLength(17)
  })

  it('label their buttons and show each one only while there is more that way', async () => {
    const region = renderRow()
    const prev = button('Previous videos in Research')
    const next = button('Next videos in Research')
    expect(prev).toHaveAttribute('data-spatial', 'skip')
    expect(next).toHaveAttribute('data-spatial', 'skip')
    const { scrollTo } = layOut(region)
    await scrollTo(0)
    expect(prev).not.toBeVisible()
    expect(next).toBeVisible()
    await scrollTo(1000)
    expect(prev).toBeVisible()
    expect(next).toBeVisible()
    await scrollTo(17 * 250 - 1000)
    expect(prev).toBeVisible()
    expect(next).not.toBeVisible()
  })

  it('page by every card in view', async () => {
    const { scrollBy, scrollTo } = layOut(renderRow())
    await scrollTo(0)
    await userEvent.click(button('Next videos in Research'))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 1000, behavior: 'smooth' })
    await frame()
    await userEvent.click(button('Previous videos in Research'))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -1000, behavior: 'smooth' })
  })

  it('hand focus to the first card of the new page when the pressed button hides', async () => {
    const { scrollTo } = layOut(renderRow())
    await scrollTo(2250)
    // The last page starts at 3250: card 14 (index 13), then 15, 16 and the tile.
    await userEvent.click(button('Next videos in Research'))
    const fourteenth = screen.getByRole('link', { name: 'Play Lecture 14' })
    expect(fourteenth).toHaveFocus()
    expect(fourteenth).toHaveAttribute('tabindex', '0')
    await frame()
    expect(button('Next videos in Research')).not.toBeVisible()

    await scrollTo(1000)
    await userEvent.click(button('Previous videos in Research'))
    expect(screen.getByRole('link', { name: 'Play Lecture 01' })).toHaveFocus()
  })

  it('move the Tab stop to the first card in view when paged while focus is elsewhere', async () => {
    const { scrollTo } = layOut(renderRow())
    await scrollTo(1000)
    expect(screen.getByRole('link', { name: 'Play Lecture 05' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('link', { name: 'Play Lecture 01' })).toHaveAttribute('tabindex', '-1')
  })
})

describe('Personal rows', () => {
  it('are carousels too: Recommended for you, one row of picks with their reasons', () => {
    const picks = lectures.slice(0, 12)
    renderAt(
      <Recommended
        title="Recommended for you"
        videos={picks}
        reasons={new Map([[picks[0].id, 'Because you searched “lecture”']])}
        cards={12}
      />,
    )
    const region = screen.getByRole('region', { name: 'Recommended for you' })
    expect(region.querySelector('[data-spatial="track"]')).not.toBeNull()
    fireEvent.pointerEnter(region.querySelector('.row')!)
    expect(within(region).getAllByRole('article')).toHaveLength(12)
    expect(within(region).getByText('Because you searched “lecture”')).toBeInTheDocument()
    expect(button('Next videos in Recommended for you')).toBeInTheDocument()
  })

  it('keep a skeleton row while the picks compute', () => {
    renderAt(<Recommended title="Recommended for you" videos={[]} pending cards={12} />)
    const region = screen.getByRole('region', { name: 'Recommended for you' })
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(within(region).queryAllByRole('article')).toHaveLength(0)
    expect(region.querySelector('.row-still')).not.toBeNull()
  })

  it('include Recently viewed, with its own buttons', () => {
    renderAt(<RecentlyViewed videos={lectures.slice(0, 8)} />)
    const region = screen.getByRole('region', { name: 'Recently viewed' })
    expect(region.querySelector('[data-spatial="track"]')).not.toBeNull()
    expect(within(region).getAllByRole('listitem')).toHaveLength(8)
    expect(button('Previous videos in Recently viewed')).toBeInTheDocument()
    expect(button('Next videos in Recently viewed')).toBeInTheDocument()
  })
})
