import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, type ReactNode } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DetailModal from './DetailModal'
import Footer from './Footer'
import Header from './Header'
import Hero from './Hero'
import Row from './Row'
import { fixtureVideos } from './test-fixtures'

vi.mock('../data/catalog.json', async () => ({
  default: (await import('./test-fixtures')).fixtureVideos,
}))

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '/watch/:id', element: <p>Player</p> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const research = fixtureVideos.slice(0, 3)

describe('Row and VideoCard', () => {
  it('renders one card per video: the card plays, More Info opens details', () => {
    renderAt('/', <Row title="Research" videos={research} />)
    const row = screen.getByRole('region', { name: 'Research' })
    expect(within(row).getAllByRole('article')).toHaveLength(3)
    expect(within(row).getByRole('link', { name: 'Play Climate Change Basics' })).toHaveAttribute(
      'href',
      '/watch/climate-basics',
    )
    const info = within(row).getByRole('link', { name: 'More info: Climate Change Basics' })
    expect(info).toHaveAttribute('href', '/?v=climate-basics')
    expect(info).not.toHaveAttribute('tabindex')
  })

  it('plays when the card is clicked', async () => {
    const router = renderAt('/', <Row title="Research" videos={research} />)
    await userEvent.click(screen.getByRole('link', { name: 'Play Ocean Science 101' }))
    expect(router.state.location.pathname).toBe('/watch/ocean-science')
  })

  it('toggles My List with aria-pressed', async () => {
    renderAt('/', <Row title="Research" videos={research} />)
    const button = screen.getByRole('button', { name: 'My List: Ocean Science 101' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('DetailModal', () => {
  it('opens for ?v=<id> with the title and similar titles, and ignores unknown ids', () => {
    renderAt('/?v=climate-basics', <DetailModal />)
    const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
    expect(dialog).toHaveAttribute('open')
    const similar = within(dialog).getByRole('region', { name: 'More Like This' })
    expect(
      within(similar).getByRole('link', { name: 'More info: Climate Policy in the Philippines' }),
    ).toHaveAttribute('href', '/?v=climate-policy')
    expect(
      within(similar).getByRole('link', { name: 'Play Climate Policy in the Philippines' }),
    ).toHaveAttribute('href', '/watch/climate-policy')
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

  it('opens from More Info on a card and closing goes back to the page', async () => {
    const router = renderAt(
      '/',
      <>
        <Row title="Research" videos={research} />
        <DetailModal />
      </>,
    )
    await userEvent.click(screen.getByRole('link', { name: 'More info: Ocean Science 101' }))
    expect(router.state.location.search).toBe('?v=ocean-science')
    const dialog = screen.getByRole('dialog', { name: 'Ocean Science 101' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    // The exit animation runs before the URL changes.
    expect(dialog).toHaveAttribute('data-closing')
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(router.state.historyAction).toBe('POP')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('titles grid cards one level below the list heading', () => {
    renderAt('/?v=climate-basics', <DetailModal />)
    const similar = screen.getByRole('region', { name: 'More Like This' })
    expect(within(similar).getAllByRole('heading', { level: 4 }).length).toBeGreaterThan(0)
  })
})

describe('Hero', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pauses while mostly scrolled out of view', () => {
    let notify: IntersectionObserverCallback = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          notify = callback
        }
        observe() {}
        disconnect() {}
      },
    )
    renderAt('/', <Hero videos={research} />)
    const hero = screen.getByRole('region', { name: 'Featured titles' })
    expect(hero).not.toHaveAttribute('data-paused')
    const entry = { intersectionRatio: 0.2 } as IntersectionObserverEntry
    act(() => notify([entry], {} as IntersectionObserver))
    expect(hero).toHaveAttribute('data-paused')
  })
})

describe('Proof-of-concept notice', () => {
  it('is shown in the header and the footer', () => {
    renderAt(
      '/',
      <>
        <Header />
        <Footer />
      </>,
    )
    expect(screen.getByRole('note', { name: 'Proof of concept' })).toHaveTextContent('PoC')
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      /^Proof of concept — a temporary, non-commercial demo .* not affiliated with, endorsed by, or intended to imitate the design of any commercial streaming service./,
    )
  })
})

describe('Header search', () => {
  function renderLayout() {
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <>
            <Header />
            <Outlet />
          </>
        ),
        children: [
          { index: true, element: <p>Home</p> },
          { path: 'search', element: <p>Results</p> },
          { path: 'my-list', element: <p>Saved</p> },
        ],
      },
    ])
    render(<RouterProvider router={router} />)
    return router
  }
  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

  it('searches shortly after typing stops', async () => {
    const router = renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(screen.getByRole('searchbox'), 'climate')
    expect(router.state.location.pathname).toBe('/')
    await wait(400)
    expect(router.state.location.pathname + router.state.location.search).toBe('/search?q=climate')
  })

  it('drops a pending search when the user navigates elsewhere', async () => {
    const router = renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.type(screen.getByRole('searchbox'), 'climate')
    await act(() => router.navigate('/my-list'))
    await wait(400)
    expect(router.state.location.pathname).toBe('/my-list')
  })
})

describe('Row See all', () => {
  it('links to the whole collection when the row shows only part of it', () => {
    renderAt(
      '/',
      <Row title="Research" videos={research} seeAll="/collections/research" total={12} />,
    )
    expect(screen.getByRole('link', { name: 'See all 12 titles in Research' })).toHaveAttribute(
      'href',
      '/collections/research',
    )
  })
})
