import { act, render, screen, waitFor } from '@testing-library/react'
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
          { path: '/watch/:id', element: <p>Video</p> },
        ],
      },
    ],
    { initialEntries: entries },
  )
  render(<RouterProvider router={router} />)
  return router
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

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

  it('from the player, Back steps over the videos watched in a row to where the first was opened', async () => {
    const router = renderAt(['/'])
    await act(() => router.navigate('/other'))
    await act(() => router.navigate('/watch/a'))
    await act(() => router.navigate('/watch/b'))
    await act(() => router.navigate('/watch/c'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/other'))
    expect(router.state.historyAction).toBe('POP')
  })

  it('from the player with only videos behind (opened from a link), Back goes home', async () => {
    const router = renderAt(['/watch/a'])
    await act(() => router.navigate('/watch/b'))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Backspace is Back outside fields', async () => {
    const router = renderAt(['/', '/other'])
    await userEvent.keyboard('{Backspace}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Esc in a field with text only blurs it and keeps the text', async () => {
    const router = renderAt(['/', '/field'])
    const field = screen.getByRole('textbox', { name: 'Field' })
    await userEvent.type(field, 'climate')
    await userEvent.keyboard('{Backspace}')
    expect(field).toHaveValue('climat')
    await userEvent.keyboard('{Escape}')
    expect(field).not.toHaveFocus()
    expect(field).toHaveValue('climat')
    await settle()
    expect(router.state.location.pathname).toBe('/field')
  })

  it('Esc in an empty field goes back', async () => {
    const router = renderAt(['/', '/field'])
    await userEvent.click(screen.getByRole('textbox', { name: 'Field' }))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Esc leaves an open dialog to itself and Backspace closes it', async () => {
    const router = renderAt(['/', '/other'])
    const dialog = document.createElement('dialog')
    dialog.open = true
    document.body.append(dialog)
    await userEvent.keyboard('{Escape}')
    expect(router.state.location.pathname).toBe('/other')
    expect(dialog.open).toBe(true)
    await userEvent.keyboard('{Backspace}')
    expect(dialog.open).toBe(false)
    await settle()
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
