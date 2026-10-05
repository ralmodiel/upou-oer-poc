import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../data/testing'
import { useGlobalShortcuts } from '../lib/shortcuts'
import { useSpatialNavigation } from '../lib/spatial'
import { setPrefs } from '../lib/storage'
import Header from './Header'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

// The app shell's keys (Esc = Back, remote arrows) around the header and a page.
function Shell() {
  useGlobalShortcuts()
  useSpatialNavigation()
  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}

function renderShell(path = '/') {
  const page = (name: string) => <a href="#below">{name}</a>
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: page('Home') },
          { path: 'search', element: page('Results') },
          { path: 'watch/:id', element: page('Player') },
          { path: 'collections/:slug', element: page('Collection') },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))
const field = () => screen.getByRole('combobox', { name: 'Search videos' })
const recorded = () =>
  (JSON.parse(localStorage.getItem('upou:searches') ?? '[]') as { q: string }[]).map((e) => e.q)

// Types into the header field and waits for its suggestions (and the search it starts).
async function typeAndList(text: string) {
  await userEvent.type(field(), text)
  const list = await screen.findByRole('listbox', { name: 'Suggestions' })
  await wait(300)
  return list
}

describe('Header search suggestions', () => {
  it('open as an ARIA combobox list that ↑ / ↓ walk while focus stays in the field', async () => {
    renderShell()
    const list = await typeAndList('clim')
    const box = field()
    expect(box).toHaveAttribute('aria-expanded', 'true')
    expect(box).toHaveAttribute('aria-controls', list.id)
    expect(box).toHaveAttribute('aria-autocomplete', 'list')
    expect(box).not.toHaveAttribute('aria-activedescendant')
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([
      'ClimateTopic',
      'Climate Change BasicsVideo',
      'Climate Policy in the PhilippinesVideo',
    ])

    await userEvent.keyboard('{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', options[0].id)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(box).toHaveAttribute('aria-activedescendant', options[2].id)
    // Past the end: back to the text as typed; ↑ from there goes to the last item.
    await userEvent.keyboard('{ArrowDown}')
    expect(box).not.toHaveAttribute('aria-activedescendant')
    await userEvent.keyboard('{ArrowUp}')
    expect(box).toHaveAttribute('aria-activedescendant', options[2].id)
    expect(box).toHaveFocus()
  })

  it('open the highlighted video on Enter, committing the typed query', async () => {
    const router = renderShell()
    await typeAndList('clim')
    expect(recorded()).toEqual([])
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(router.state.location.pathname).toBe('/watch/climate-basics')
    expect(field()).not.toHaveFocus()
    expect(recorded()).toEqual(['clim'])
  })

  it('search for a topic as if submitted, and record nothing when searches are off', async () => {
    setPrefs({ searches: false })
    const router = renderShell()
    await typeAndList('clim')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(router.state.location.pathname + router.state.location.search).toBe('/search?q=Climate')
    expect(router.state.location.state).toMatchObject({ submitted: true })
    expect(field()).toHaveValue('Climate')
    expect(recorded()).toEqual([])
  })

  it('close on the first Esc without going Back; the next Esc leaves the field', async () => {
    const router = renderShell()
    await typeAndList('clim')
    const at = router.state.location.key
    await userEvent.keyboard('{ArrowDown}{Escape}')
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).not.toHaveAttribute('aria-activedescendant')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(field()).toHaveFocus()
    expect(router.state.location.key).toBe(at)
    await userEvent.keyboard('{Escape}')
    expect(field()).not.toHaveFocus()
    expect(field()).toHaveValue('clim')
    expect(router.state.location.key).toBe(at)
  })

  it('highlight under the pointer and open on a click, keeping focus in the field until then', async () => {
    const router = renderShell()
    const list = await typeAndList('film')
    const option = within(list).getByRole('option', { name: /Film Making for Beginners/ })
    await userEvent.hover(option)
    expect(option).toHaveAttribute('aria-selected', 'true')
    expect(field()).toHaveFocus()
    await userEvent.click(option)
    expect(router.state.location.pathname).toBe('/watch/film-making')
  })

  it('put the fix for a misspelt query first', async () => {
    const router = renderShell()
    const list = await typeAndList('climte change')
    const options = within(list).getAllByRole('option')
    expect(options[0]).toHaveTextContent('climate changeSearch')
    expect(options[1]).toHaveTextContent('Climate Change BasicsVideo')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(router.state.location.search).toBe('?q=climate%20change'))
  })

  it('stay closed for a single letter and close when the field is cleared', async () => {
    renderShell()
    await userEvent.type(field(), 'c')
    await wait(200)
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    await typeAndList('l')
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    // Cleared before the pause ends: the pending suggestions never open.
    await userEvent.type(field(), 'cl')
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    await wait(200)
    expect(field()).toHaveFocus()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
  })

  it('bring the field up when the list would open past the foot of a short screen', async () => {
    renderShell()
    const scroll = vi.fn()
    field().scrollIntoView = scroll
    // jsdom lays nothing out: first a list that fits, then one past the foot (768px).
    const rect = vi.spyOn(HTMLUListElement.prototype, 'getBoundingClientRect')
    try {
      rect.mockReturnValue(new DOMRect(0, 100, 300, 250))
      await typeAndList('clim')
      expect(scroll).not.toHaveBeenCalled()
      await userEvent.keyboard('{Escape}')
      rect.mockReturnValue(new DOMRect(0, 600, 300, 250))
      await typeAndList('a')
      expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
    } finally {
      rect.mockRestore()
    }
  })
})
