import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, type ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getRows } from '../data/catalog'
import { setCatalog } from '../data/testing'
import { useSpatialNavigation } from '../lib/spatial'
import CollectionChips from './CollectionChips'
import ContinueWatching from './ContinueWatching'
import DetailModal from './DetailModal'
import Featured from './Featured'
import Section from './Section'
import VideoGrid from './VideoGrid'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/collections/:slug', element: <p>Collection</p> },
      { path: '/watch/:id', element: <p>Player</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const research = fixtureVideos.slice(0, 3)
const researchRow = () => getRows().find((r) => r.slug === 'research')!

describe('Section and VideoCard', () => {
  it('renders a heading, a See all link and one card per video', () => {
    renderAt('/', <Section row={researchRow()} />)
    const section = screen.getByRole('region', { name: 'Research' })
    expect(within(section).getAllByRole('article')).toHaveLength(3)
    expect(within(section).getByRole('link', { name: 'See all (3) in Research' })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    expect(
      within(section).getByRole('link', { name: 'Play Climate Change Basics' }),
    ).toHaveAttribute('href', '/watch/climate-basics')
    expect(
      within(section).getByRole('link', { name: 'Details: Climate Change Basics' }),
    ).toHaveAttribute('href', '/?v=climate-basics')
  })

  it('plays when the card is clicked', async () => {
    const router = renderAt('/', <Section row={researchRow()} />)
    await userEvent.click(screen.getByRole('link', { name: 'Play Ocean Science 101' }))
    expect(router.state.location.pathname).toBe('/watch/ocean-science')
  })

  it('toggles Save with aria-pressed', async () => {
    renderAt('/', <Section row={researchRow()} />)
    const button = screen.getByRole('button', { name: 'Save Ocean Science 101' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveTextContent('Save')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('Saved')
    expect(JSON.parse(localStorage.getItem('upou:my-list')!)).toEqual(['ocean-science'])
  })

  it('shows the date and the New marker, and names the category only outside its section', () => {
    renderAt(
      '/',
      <>
        <Section row={researchRow()} />
        <VideoGrid videos={research.slice(0, 1)} />
      </>,
    )
    const [inSection, inGrid] = screen
      .getAllByRole('link', { name: 'Play Climate Change Basics' })
      .map((link) => link.closest('article')!)
    expect(within(inSection).getByText('May 1, 2026')).toBeInTheDocument()
    expect(within(inSection).getByText('New')).toBeInTheDocument()
    expect(within(inSection).queryByText('Research')).not.toBeInTheDocument()
    expect(within(inGrid).getByText('Research')).toBeInTheDocument()
  })
})

// The app shell's spatial navigation owns the arrow keys; jsdom has no layout, so lay the cards
// out in one row by hand.
function SpatialShell({ children }: { children: ReactNode }) {
  useSpatialNavigation()
  return children
}
function layOutCardsInARow() {
  document.querySelectorAll('article').forEach((card, i) => {
    const left = i * 320
    card.getBoundingClientRect = () =>
      ({ top: 100, left, width: 300, height: 200, right: left + 300, bottom: 300 }) as DOMRect
  })
}

describe('VideoGrid keyboard (roving tabindex)', () => {
  it('puts one card in the Tab order and moves between cards with the arrow keys', async () => {
    renderAt(
      '/',
      <SpatialShell>
        <VideoGrid videos={research} />
      </SpatialShell>,
    )
    layOutCardsInARow()
    const play = (title: string) => screen.getByRole('link', { name: `Play ${title}` })
    expect(play('Climate Change Basics')).toHaveAttribute('tabindex', '0')
    expect(play('Climate Policy in the Philippines')).toHaveAttribute('tabindex', '-1')

    await userEvent.tab()
    expect(play('Climate Change Basics')).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    expect(play('Climate Policy in the Philippines')).toHaveFocus()
    expect(play('Climate Policy in the Philippines')).toHaveAttribute('tabindex', '0')
    expect(play('Climate Change Basics')).toHaveAttribute('tabindex', '-1')
    await userEvent.keyboard('{End}')
    expect(play('Ocean Science 101')).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(play('Climate Change Basics')).toHaveFocus()

    // Tab visits the current card's actions, then leaves the grid.
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save Climate Change Basics' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Details: Climate Change Basics' })).toHaveFocus()
    await userEvent.tab()
    expect(document.activeElement?.closest('ul')).toBeNull()
  })
})

describe('Featured', () => {
  it('shows the featured video with Play and Details, and steps with prev/next', async () => {
    renderAt('/', <Featured videos={research} alsoNew={fixtureVideos.slice(3, 7)} />)
    const region = screen.getByRole('region', { name: 'Featured' })
    expect(within(region).getByRole('heading', { level: 3, name: 'Climate Change Basics' }))
    expect(within(region).getByRole('link', { name: 'Play' })).toHaveAttribute(
      'href',
      '/watch/climate-basics',
    )
    expect(within(region).getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      '/?v=climate-basics',
    )
    expect(within(region).getByText('1 of 3')).toBeInTheDocument()
    const alsoNew = within(region).getByRole('complementary', { name: 'Also new' })
    expect(within(alsoNew).getAllByRole('listitem')).toHaveLength(4)
    expect(within(alsoNew).getByRole('link', { name: 'Play Digital Art Studio' })).toHaveAttribute(
      'href',
      '/watch/digital-art',
    )

    await userEvent.click(within(region).getByRole('button', { name: 'Next featured video' }))
    expect(within(region).getByText('2 of 3')).toBeInTheDocument()
    expect(within(region).getByRole('link', { name: 'Play' })).toHaveAttribute(
      'href',
      '/watch/climate-policy',
    )
    await userEvent.click(within(region).getByRole('button', { name: 'Previous featured video' }))
    await userEvent.click(within(region).getByRole('button', { name: 'Previous featured video' }))
    expect(within(region).getByText('3 of 3')).toBeInTheDocument()
  })

  it('does not mark the featured image as a Tab stop', () => {
    renderAt('/', <Featured videos={research} alsoNew={[]} />)
    const image = document.querySelector('a[aria-hidden="true"]')
    expect(image).toHaveAttribute('href', '/watch/climate-basics')
    expect(image).toHaveAttribute('tabindex', '-1')
  })
})

describe('ContinueWatching and CollectionChips', () => {
  it('renders nothing without history and a strip with it', () => {
    const { rerender } = render(<ContinueWatching videos={[]} />)
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    rerender(<></>)
    renderAt('/', <ContinueWatching videos={research.slice(0, 2)} />)
    const strip = screen.getByRole('region', { name: 'Continue watching' })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(2)
    expect(within(strip).getByRole('link', { name: 'Play Climate Change Basics' })).toHaveAttribute(
      'href',
      '/watch/climate-basics',
    )
  })

  it('lists every collection with its count', () => {
    renderAt('/', <CollectionChips />)
    const section = screen.getByRole('region', { name: 'Collections' })
    expect(within(section).getByRole('link', { name: /^Research \(3\)$/ })).toHaveAttribute(
      'href',
      '/collections/research',
    )
    expect(within(section).getByRole('link', { name: 'All collections (3)' })).toHaveAttribute(
      'href',
      '/collections',
    )
  })
})

describe('DetailModal', () => {
  it('opens for ?v=<id> with the title and similar titles, and ignores unknown ids', () => {
    renderAt('/?v=climate-basics', <DetailModal />)
    const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).getByRole('link', { name: 'Play' })).toHaveAttribute(
      'href',
      '/watch/climate-basics',
    )
    expect(within(dialog).getByRole('button', { name: 'Save Climate Change Basics' }))
    expect(within(dialog).getByRole('link', { name: /Watch on YouTube/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abcdefghijk',
    )
    expect(within(dialog).getByRole('link', { name: 'Climate' })).toHaveAttribute(
      'href',
      '/search?q=Climate',
    )
    const similar = within(dialog).getByRole('region', { name: 'More like this' })
    expect(
      within(similar).getByRole('link', { name: 'Details: Climate Policy in the Philippines' }),
    ).toHaveAttribute('href', '/?v=climate-policy')
    expect(
      within(similar).getByRole('link', { name: 'Play Climate Policy in the Philippines' }),
    ).toHaveAttribute('href', '/watch/climate-policy')
    expect(within(similar).getAllByRole('heading', { level: 4 }).length).toBeGreaterThan(0)
  })

  it('stays open under StrictMode, whose remount sees a late close event', async () => {
    // Browsers fire `close` asynchronously; mimic that so the event can reach the remounted dialog.
    const proto = HTMLDialogElement.prototype
    const { showModal, close } = proto
    proto.showModal = function () {
      this.setAttribute('open', '')
    }
    proto.close = function () {
      if (!this.hasAttribute('open')) return
      this.removeAttribute('open')
      setTimeout(() => this.dispatchEvent(new Event('close')))
    }
    try {
      const router = createMemoryRouter([{ path: '/', element: <DetailModal /> }], {
        initialEntries: ['/?v=climate-basics'],
      })
      render(
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
      )
      await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
      expect(screen.getByRole('dialog', { name: 'Climate Change Basics' })).toHaveAttribute('open')
      expect(router.state.location.search).toBe('?v=climate-basics')
    } finally {
      proto.showModal = showModal
      proto.close = close
    }
  })

  it('renders nothing for an unknown id', () => {
    renderAt('/?v=missing', <DetailModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens from Details on a card and closing goes back to the page', async () => {
    const router = renderAt(
      '/',
      <>
        <Section row={researchRow()} />
        <DetailModal />
      </>,
    )
    await userEvent.click(screen.getByRole('link', { name: 'Details: Ocean Science 101' }))
    expect(router.state.location.search).toBe('?v=ocean-science')
    const dialog = screen.getByRole('dialog', { name: 'Ocean Science 101' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    // The exit animation runs before the URL changes.
    expect(dialog).toHaveAttribute('data-closing')
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(router.state.historyAction).toBe('POP')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
