import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { setCatalog } from '../data/testing'
import Footer from './Footer'
import Header from './Header'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

function renderLayout() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <>
          <Header />
          <Outlet />
          <Footer />
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

describe('Proof-of-concept notice', () => {
  it('is shown in the header and the footer', () => {
    renderLayout()
    expect(screen.getByRole('note', { name: 'Proof of concept' })).toHaveTextContent(
      'Proof of concept',
    )
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/proof of concept/i)
  })
})

describe('Header search', () => {
  it('searches shortly after typing stops', async () => {
    const router = renderLayout()
    const box = screen.queryByRole('searchbox')
    if (!box) await userEvent.click(screen.getByRole('button', { name: /search/i }))
    await userEvent.type(screen.getByRole('searchbox'), 'climate')
    expect(router.state.location.pathname).toBe('/')
    await wait(400)
    expect(router.state.location.pathname + router.state.location.search).toBe('/search?q=climate')
  })

  it('drops a pending search when the user navigates elsewhere', async () => {
    const router = renderLayout()
    const box = screen.queryByRole('searchbox')
    if (!box) await userEvent.click(screen.getByRole('button', { name: /search/i }))
    await userEvent.type(screen.getByRole('searchbox'), 'climate')
    await act(() => router.navigate('/my-list'))
    await wait(400)
    expect(router.state.location.pathname).toBe('/my-list')
  })
})
