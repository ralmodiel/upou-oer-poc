import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { setCatalog } from '../data/testing'
import { HOW_IT_WORKS_KEY } from '../lib/howitworks'
import Footer from './Footer'
import Header, { TabBar } from './Header'
import HowItWorks from './HowItWorks'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

function renderAt(path: string, element: ReactNode) {
  const router = createMemoryRouter([{ path: '*', element }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Header and tab bar', () => {
  it('show the wordmark, PoC pill, the current section and the My List count', () => {
    // One saved id is gone from the catalog and must not be counted.
    localStorage.setItem('upou:my-list', JSON.stringify(['climate-basics', 'missing-id']))
    renderAt(
      '/collections',
      <>
        <Header />
        <TabBar />
      </>,
    )
    expect(screen.getByRole('link', { name: 'UPOU Networks, home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('note', { name: 'Proof of concept' })).toHaveTextContent('PoC')

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

  it('switch the theme from the header', async () => {
    renderAt('/', <Header />)
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('HowItWorks', () => {
  it('lists three steps and remembers "Got it"', async () => {
    const { unmount } = render(<HowItWorks />)
    const strip = screen.getByRole('region', { name: 'How it works' })
    expect(within(strip).getAllByRole('listitem')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('region', { name: 'How it works' })).not.toBeInTheDocument()
    expect(localStorage.getItem(HOW_IT_WORKS_KEY)).toBe('true')

    unmount()
    render(<HowItWorks />)
    expect(screen.queryByRole('region', { name: 'How it works' })).not.toBeInTheDocument()
  })

  it('comes back through the footer Help link', async () => {
    localStorage.setItem(HOW_IT_WORKS_KEY, 'true')
    renderAt(
      '/my-list',
      <>
        <HowItWorks />
        <Footer />
      </>,
    )
    expect(screen.queryByRole('region', { name: 'How it works' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Help: how it works' }))
    expect(screen.getByRole('region', { name: 'How it works' })).toBeInTheDocument()
    expect(localStorage.getItem(HOW_IT_WORKS_KEY)).toBe('false')
  })
})
