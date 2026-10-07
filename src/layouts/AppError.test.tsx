import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { AppError } from './AppLayout'

afterEach(() => sessionStorage.clear())

const renderFailing = (loader: () => unknown) => {
  const router = createMemoryRouter(
    [{ path: '/', loader, Component: () => <h1>Loaded</h1>, ErrorBoundary: AppError }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

it('keeps the header on a catalog failure and tries again in place', async () => {
  let fail = true
  renderFailing(() => {
    if (fail) throw new Error('catalog file 3: 500')
    return null
  })
  await screen.findByRole('heading', { name: 'Couldn’t load the video list' })
  expect(screen.getByRole('banner')).toBeInTheDocument()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('heading', { name: 'Loaded' })
})

it('reloads once when a page’s code fails to load, never in a loop', async () => {
  const reload = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload })
  try {
    const chunk = () => {
      throw new TypeError('Failed to fetch dynamically imported module: /assets/WatchPage-x.js')
    }
    const { unmount } = renderFailing(chunk)
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    unmount()
    renderFailing(chunk)
    await screen.findByRole('heading', { name: 'Something went wrong' })
    expect(reload).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
  }
})
