import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { FOCUS_SEARCH_EVENT, OPEN_SHORTCUTS_EVENT, useGlobalShortcuts } from './shortcuts'

function Shell() {
  useGlobalShortcuts()
  return <Outlet />
}

function renderAt(entries: string[]) {
  const router = createMemoryRouter(
    [
      {
        Component: Shell,
        children: [
          { path: '/', element: <p>Home</p> },
          { path: '/field', element: <input aria-label="Field" /> },
          { path: '/other', element: <p>Other</p> },
        ],
      },
    ],
    { initialEntries: entries },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('useGlobalShortcuts', () => {
  it('Esc goes back when the app has history', async () => {
    const router = renderAt(['/', '/other'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Esc goes home when the page was opened directly', async () => {
    const router = renderAt(['/other'])
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Esc inside a text field only blurs it', async () => {
    const router = renderAt(['/', '/field'])
    const field = screen.getByRole('textbox', { name: 'Field' })
    await userEvent.click(field)
    expect(field).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(field).not.toHaveFocus()
    expect(router.state.location.pathname).toBe('/field')
  })

  it('Esc leaves an open dialog to itself', async () => {
    const router = renderAt(['/', '/other'])
    const dialog = document.createElement('dialog')
    dialog.open = true
    document.body.append(dialog)
    await userEvent.keyboard('{Escape}')
    expect(router.state.location.pathname).toBe('/other')
    dialog.remove()
  })

  it('/ asks for the search field and ? opens the sheet, but not while typing', async () => {
    renderAt(['/field'])
    const focus = vi.fn()
    const open = vi.fn()
    window.addEventListener(FOCUS_SEARCH_EVENT, focus)
    window.addEventListener(OPEN_SHORTCUTS_EVENT, open)
    try {
      await userEvent.keyboard('/?')
      expect(focus).toHaveBeenCalledTimes(1)
      expect(open).toHaveBeenCalledTimes(1)

      await userEvent.click(screen.getByRole('textbox', { name: 'Field' }))
      await userEvent.keyboard('/?')
      expect(focus).toHaveBeenCalledTimes(1)
      expect(open).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(FOCUS_SEARCH_EVENT, focus)
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, open)
    }
  })
})
