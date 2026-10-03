import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { setCatalog } from '../data/testing'
import { HOW_IT_WORKS_KEY } from '../lib/howitworks'
import Footer from './Footer'
import Header, { TabBar } from './Header'
import HowItWorks from './HowItWorks'
import ShortcutsSheet from './ShortcutsSheet'
import { useReturnFocus } from './hooks'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Header and tab bar', () => {
  it('show the wordmark, Proof of concept pill, the current section and the My List count', () => {
    // One saved id is gone from the catalog and must not be counted.
    localStorage.setItem('upou:my-list', JSON.stringify(['climate-basics', 'missing-id']))
    renderAt(
      '/collections',
      <>
        <Header />
        <TabBar />
      </>,
    )
    expect(screen.getByRole('link', { name: 'UPOU OER, home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('note', { name: 'Proof of concept' })).toHaveTextContent(
      'Proof of concept',
    )
    expect(screen.getByRole('banner')).toHaveTextContent('Open Educational Resources')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/', '/collections', '/my-list'])
    expect(within(nav).getByRole('link', { name: 'Collections' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Browse' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getByRole('link', { name: 'My List, 1 saved' })).toHaveTextContent('1')

    const tabs = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(tabs).getAllByRole('link')).toHaveLength(4)
    expect(within(tabs).getByRole('link', { name: 'My List, 1 saved' })).toHaveTextContent('1')
    expect(screen.getByRole('searchbox', { name: 'Search videos' })).toBeInTheDocument()
  })

  it('fill the search field on /search/ too (a direct load of the static shell lands there)', async () => {
    const router = renderAt('/search/?q=climate', <Header />)
    const field = screen.getByRole('searchbox', { name: 'Search videos' })
    expect(field).toHaveValue('climate')
    // On the search page typing replaces the entry instead of adding one per key.
    await userEvent.type(field, 's')
    await waitFor(() => expect(router.state.location.search).toBe('?q=climates'))
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('keep the theme to one header control, with every choice in the Help menu', () => {
    renderAt('/', <Header />)
    expect(screen.queryByRole('group', { name: 'Theme' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Theme: / })).toHaveLength(1)
  })

  it('flip the effective theme with the compact toggle on the first tap', async () => {
    renderAt('/', <Header />)
    const flip = screen.getByRole('button', { name: 'Theme: light. Switch to dark' })
    await userEvent.click(flip)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(flip).toHaveAccessibleName('Theme: dark. Switch to light')
    await userEvent.click(flip)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('offer help, shortcuts and (on narrow screens) the theme from the Help menu', async () => {
    renderAt('/my-list', <Header />)
    const trigger = screen.getByRole('button', { name: 'Help and theme' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    const menu = screen.getByRole('menu', { name: 'Help and theme' })
    expect(within(menu).getByRole('menuitem', { name: 'How it works' })).toHaveFocus()
    expect(within(menu).getByRole('menuitem', { name: /Keyboard shortcuts/ })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await userEvent.keyboard('{ArrowUp}')
    expect(within(menu).getByRole('menuitemradio', { name: 'System' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('ShortcutsSheet', () => {
  it('lists the remote keys, including what ↓ does from a card and in a chip row', () => {
    render(<ShortcutsSheet />)
    expect(
      screen.getByText('From a card, ↓ reaches its Save and Details before the next row'),
    ).toBeInTheDocument()
    expect(screen.getByText('Along a row of chips (↑ or ↓ leaves the row)')).toBeInTheDocument()
    expect(screen.getByText('Previous or next section of the page')).toBeInTheDocument()
  })
})

describe('HowItWorks', () => {
  it('lists three steps under a UPOU OER heading and remembers "Got it"', async () => {
    const { unmount } = render(<HowItWorks />)
    const strip = screen.getByRole('region', {
      name: 'UPOU OER — Open Educational Resources, in three steps',
    })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(3)

    await userEvent.click(screen.getAllByRole('button', { name: 'Got it' })[0])
    expect(screen.queryByRole('region', { name: /UPOU OER/ })).not.toBeInTheDocument()
    expect(localStorage.getItem(HOW_IT_WORKS_KEY)).toBe('true')

    unmount()
    render(<HowItWorks />)
    expect(screen.queryByRole('region', { name: /UPOU OER/ })).not.toBeInTheDocument()
  })

  it('comes back, with focus on its heading, through the footer Help link', async () => {
    localStorage.setItem(HOW_IT_WORKS_KEY, 'true')
    renderAt(
      '/my-list',
      <>
        <HowItWorks />
        <Footer />
      </>,
    )
    expect(screen.queryByRole('region', { name: /UPOU OER/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Help: how it works' }))
    expect(screen.getByRole('region', { name: /UPOU OER/ })).toBeInTheDocument()
    // The focus waits a frame for the router's scroll restoration.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: /UPOU OER/ })).toHaveFocus(),
    )
    expect(localStorage.getItem(HOW_IT_WORKS_KEY)).toBe('false')
  })
})

describe('useReturnFocus', () => {
  it('puts focus back on the card that opened the player after Back', async () => {
    function Shell() {
      useReturnFocus()
      return <Outlet />
    }
    const router = createMemoryRouter([
      {
        element: <Shell />,
        children: [
          {
            path: '/',
            element: (
              <Link to="/watch/climate-basics" data-card-link="">
                Play Climate Change Basics
              </Link>
            ),
          },
          { path: '/watch/:id', element: <p>Player</p> },
        ],
      },
    ])
    render(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('link', { name: 'Play Climate Change Basics' }))
    expect(screen.getByText('Player')).toBeInTheDocument()
    await act(() => router.navigate(-1))
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Play Climate Change Basics' })).toHaveFocus(),
    )
  })
})
