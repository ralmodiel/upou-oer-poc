import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { slugifyCategory } from '../data/catalog'
import { setFrameFlags } from '../data/frameFlags'
import { setCatalog } from '../data/testing'
import { REEL_MS } from '../features/reel/PromoReel'
import { DECODE_CAP_MS } from '../features/reel/preload'
import { testVideo } from '../features/reel/testing'
import { FINE_POINTER_QUERY } from '../lib/pointer'
import { warmRecommender, warmRecommenderAsync } from '../lib/recommend'
import WatchPage from './WatchPage'

// Nine look-alikes in the same category, so "Up next" has more than it shows.
const similar = Array.from({ length: 9 }, (_, i) => ({
  ...testVideo,
  id: `similar-${i}`,
  youtubeId: `sim${i}`.padEnd(11, 'x'),
  title: `Similar video ${i}`,
}))

function renderAt(
  entries: (string | { pathname: string; state?: unknown })[],
  index = entries.length - 1,
) {
  const router = createMemoryRouter(
    [
      { path: '/watch/:id', Component: WatchPage },
      { path: '/', element: <p>Home</p> },
    ],
    { initialEntries: entries, initialIndex: index },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, ...view }
}

const setClipboard = (writeText: () => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

// jsdom matches no media query; a mouse-and-keyboard device for the tests that need one.
const matchMedia = window.matchMedia
const withFinePointer = () => {
  window.matchMedia = (query: string) => ({
    ...matchMedia(query),
    matches: query === FINE_POINTER_QUERY,
  })
}

beforeEach(() => setCatalog([testVideo, ...similar]))
afterEach(() => {
  vi.useRealTimers()
  window.matchMedia = matchMedia
})

describe('WatchPage', () => {
  it('plays the reel in a focused stage, then the player, without focusing the iframe', async () => {
    vi.useFakeTimers()
    renderAt([`/watch/${testVideo.id}`])

    const stage = screen.getByRole('region', { name: 'Preview' })
    expect(stage).toHaveFocus()
    expect(within(stage).getByRole('group', { name: `Preview: ${testVideo.title}` })).toBeVisible()
    expect(screen.queryByTitle(`${testVideo.title} (YouTube video)`)).not.toBeInTheDocument()
    expect(document.title).toBe(`${testVideo.title} · UPOU OER`)

    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    await act(() => vi.advanceTimersByTimeAsync(REEL_MS))

    const frame = screen.getByTitle(`${testVideo.title} (YouTube video)`)
    expect(frame).toHaveAttribute(
      'src',
      expect.stringMatching(/^https:\/\/www\.youtube-nocookie\.com\/embed\/abcDEF12345\?/),
    )
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
    expect(screen.queryByRole('group', { name: /Preview/ })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Video player' })).toHaveFocus()
    fireEvent.load(frame)
    expect(frame).not.toHaveFocus()
    expect(JSON.parse(localStorage.getItem('upou:history') ?? '[]')[0]?.id).toBe(testVideo.id)
  })

  it('shows the Esc hint only the first time, and only to fine pointers', () => {
    const touch = renderAt([`/watch/${testVideo.id}`])
    expect(screen.queryByText('to go back', { exact: false })).not.toBeInTheDocument()
    expect(localStorage.getItem('upou:esc-hint')).toBeNull()
    touch.unmount()

    withFinePointer()
    const first = renderAt([`/watch/${testVideo.id}`])
    expect(screen.getByText('to go back', { exact: false })).toBeInTheDocument()
    expect(localStorage.getItem('upou:esc-hint')).toBe('true')
    first.unmount()

    renderAt([`/watch/${testVideo.id}`])
    expect(screen.queryByText('to go back', { exact: false })).not.toBeInTheDocument()
  })

  it('steps into the reel controls with ↓; the stage rings only after keyboard use', () => {
    renderAt([`/watch/${testVideo.id}`])
    const stage = screen.getByRole('region', { name: 'Preview' })
    expect(stage).toHaveFocus()
    expect(stage).not.toHaveAttribute('data-kbd')

    fireEvent.keyDown(stage, { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveFocus()
    expect(stage).toHaveAttribute('data-kbd')

    fireEvent.pointerDown(document.body)
    expect(stage).not.toHaveAttribute('data-kbd')

    // Enter on the stage (a remote's OK) skips straight to the player.
    stage.focus()
    fireEvent.keyDown(stage, { key: 'Enter' })
    expect(screen.getByTitle(`${testVideo.title} (YouTube video)`)).toBeInTheDocument()
    const player = screen.getByRole('region', { name: 'Video player' })
    expect(player).toHaveFocus()

    // → reaches "Up next" where it sits beside the stage; stacked below, it is left to the shell.
    const next = document.querySelector<HTMLElement>('.watch-next')!
    const right = vi.spyOn(player, 'getBoundingClientRect')
    vi.spyOn(next, 'getBoundingClientRect').mockReturnValue({ left: 840 } as DOMRect)
    right.mockReturnValue({ right: 900 } as DOMRect)
    fireEvent.keyDown(player, { key: 'ArrowRight' })
    expect(player).toHaveFocus()
    right.mockReturnValue({ right: 800 } as DOMRect)
    fireEvent.keyDown(player, { key: 'ArrowRight' })
    expect(next).toHaveFocus()
  })

  it('shows the description only when the source published one', () => {
    renderAt([`/watch/${testVideo.id}`])
    expect(screen.getByText(testVideo.description.slice(0, 40), { exact: false })).toBeVisible()

    setCatalog([{ ...testVideo, id: 'bare', description: '' }, ...similar])
    renderAt(['/watch/bare'])
    expect(screen.queryByText(/No description/)).not.toBeInTheDocument()
  })

  it('lays out breadcrumbs, meta, tags and eight "Up next" videos', () => {
    renderAt([`/watch/${testVideo.id}`])
    const slug = `/collections/${slugifyCategory(testVideo.category)}`

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumbs).getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/')
    expect(within(crumbs).getByRole('link', { name: testVideo.category })).toHaveAttribute(
      'href',
      slug,
    )
    expect(screen.getByRole('heading', { level: 1, name: testVideo.title })).not.toHaveAttribute(
      'data-long',
    )
    // Under the title the collection is a tab in its brand colour, beside the licence fact.
    const tabs = screen.getAllByRole('link', { name: testVideo.category })
    expect(tabs.map((a) => a.getAttribute('href'))).toEqual([slug, slug])
    expect(tabs[1]).toHaveClass('watch-tab')
    expect(tabs[1].closest('[data-tone]')).toHaveAttribute('data-tone')
    expect(screen.getByText('Free · CC BY 4.0')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Watch on YouTube/ })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=abcDEF12345',
    )
    expect(screen.getByRole('link', { name: /View on oer.upou.edu.ph/ })).toHaveAttribute(
      'href',
      testVideo.sourceUrl,
    )
    expect(screen.getByRole('link', { name: 'Open Data' })).toHaveAttribute(
      'href',
      '/search?q=Open%20Data',
    )
    expect(screen.queryByRole('link', { name: 'Video Post' })).not.toBeInTheDocument()
    // The topic chips are one stop for ↑ / ↓ on a remote.
    expect(screen.getByRole('link', { name: 'Open Data' }).closest('ul')).toHaveAttribute(
      'data-spatial',
      'group',
    )

    const upNext = within(screen.getByRole('list', { name: 'Up next' })).getAllByRole('link')
    expect(upNext).toHaveLength(8)
    expect(upNext.map((a) => a.getAttribute('href'))).not.toContain(`/watch/${testVideo.id}`)
    expect(screen.getByRole('link', { name: /More in Technology and Teaching/ })).toHaveAttribute(
      'href',
      slug,
    )
  })

  it('stands in with the collection until the recommender is built, then swaps in place', async () => {
    renderAt([`/watch/${testVideo.id}`])
    const list = screen.getByRole('list', { name: 'Up next' })
    const rows = within(list).getAllByRole('link')
    // Stand-ins: the collection eyebrow, no reasons yet.
    expect(rows).toHaveLength(8)
    expect(list.querySelectorAll('.eyebrow')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Loading…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    // Focus on the list holds the swap; it happens once focus leaves, in the same rows.
    act(() => rows[0].focus())
    await act(() => warmRecommenderAsync())
    expect(document.activeElement).toBe(rows[0])
    expect(list.querySelectorAll('.eyebrow')).toHaveLength(8)
    act(() => rows[0].blur())
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    const after = within(list).getAllByRole('link')
    after.forEach((row, i) => expect(row).toBe(rows[i]))
    expect(list.querySelectorAll('.eyebrow')).toHaveLength(0)
    expect(after.map((a) => a.getAttribute('href'))).not.toContain(`/watch/${testVideo.id}`)
    // Nine look-alikes, eight shown: one more to add, then More… goes.
    fireEvent.click(screen.getByRole('button', { name: 'More…' }))
    expect(within(list).getAllByRole('link')).toHaveLength(9)
    expect(screen.queryByRole('button', { name: /More…|Loading…/ })).not.toBeInTheDocument()
  })

  it('gives an "Up next" video with no clean image its title tile, never a flagged frame', () => {
    const flagged = similar[0]
    setFrameFlags({ [flagged.youtubeId]: 0b1111 })
    try {
      renderAt([`/watch/${testVideo.id}`])
      const row = screen.getByRole('link', { name: new RegExp(flagged.title) })
      expect(row.querySelector('[data-title-tile]')).toHaveTextContent(flagged.title)
      expect(row.querySelector('img')).toBeNull()
    } finally {
      setFrameFlags({})
    }
  })

  it('shows the picks at once when the recommender is ready', () => {
    warmRecommender()
    renderAt([`/watch/${testVideo.id}`])
    const list = screen.getByRole('list', { name: 'Up next' })
    expect(within(list).getAllByRole('link')).toHaveLength(8)
    expect(list.querySelectorAll('.eyebrow')).toHaveLength(0)
    expect(list.querySelector('[aria-current]')).toBeNull()
    expect(screen.getByRole('button', { name: 'More…' })).not.toHaveAttribute('aria-disabled')
  })

  describe('as a playlist', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...similar[0],
      id: `pick-${i}`,
      youtubeId: `pick${i}`.padEnd(11, 'x'),
      title: `Similar video ${i}`,
    }))
    const rowsOf = () => within(screen.getByRole('list', { name: 'Up next' })).getAllByRole('link')
    const hrefs = () => rowsOf().map((a) => a.getAttribute('href'))
    const playlistOf = (state: unknown) => (state as { playlist?: unknown } | null)?.playlist

    beforeEach(() => {
      setCatalog([testVideo, ...many])
      warmRecommender()
    })

    it('keeps the list when a row is chosen and marks the row now playing', async () => {
      const { router } = renderAt([`/watch/${testVideo.id}`])
      const shown = hrefs()
      await act(() => fireEvent.click(rowsOf()[2]))
      expect(router.state.location.pathname).toBe(shown[2])
      expect(hrefs()).toEqual(shown)
      expect(rowsOf()[2]).toHaveAttribute('aria-current', 'true')
      expect(rowsOf()[2]).toHaveTextContent('Now playing')
      expect(playlistOf(router.state.location.state)).toEqual({
        from: testVideo.id,
        ids: shown.map((h) => h?.replace('/watch/', '')),
      })

      // Another row: the same list, the mark moves; Back restores each entry's own row.
      await act(() => fireEvent.click(rowsOf()[5]))
      expect(hrefs()).toEqual(shown)
      expect(rowsOf()[5]).toHaveAttribute('aria-current', 'true')
      expect(rowsOf()[2]).not.toHaveAttribute('aria-current')
      await act(() => router.navigate(-1))
      expect(router.state.location.pathname).toBe(shown[2])
      expect(hrefs()).toEqual(shown)
      expect(rowsOf()[2]).toHaveAttribute('aria-current', 'true')
    })

    it('More… appends the next eight in order, focuses the first and keeps them in history', async () => {
      const { router } = renderAt([`/watch/${testVideo.id}`])
      await act(() => fireEvent.click(rowsOf()[0]))
      const shown = hrefs()
      await act(() => fireEvent.click(screen.getByRole('button', { name: 'More…' })))
      const rows = rowsOf()
      expect(rows).toHaveLength(16)
      expect(hrefs().slice(0, 8)).toEqual(shown)
      expect(new Set(hrefs()).size).toBe(16)
      expect(hrefs()).not.toContain(`/watch/${testVideo.id}`)
      expect(rows[8]).toHaveFocus()
      expect(playlistOf(router.state.location.state)).toEqual({
        from: testVideo.id,
        ids: hrefs().map((h) => h?.replace('/watch/', '')),
      })
    })

    it('ignores a playlist that does not list the video, as on a deep link', () => {
      renderAt([
        { pathname: `/watch/${testVideo.id}`, state: { playlist: { from: 'x', ids: ['pick-1'] } } },
      ])
      expect(rowsOf()).toHaveLength(8)
      expect(
        screen.getByRole('list', { name: 'Up next' }).querySelector('[aria-current]'),
      ).toBeNull()
    })
  })

  it('shares one unflagged poster between the stage, the reel and the backdrop', async () => {
    vi.useFakeTimers()
    const poster = 'https://i.ytimg.com/vi/abcDEF12345/maxres2.jpg'
    setCatalog([{ ...testVideo, poster }, ...similar])
    const { container } = renderAt([`/watch/${testVideo.id}`])
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
    const srcs = (selector: string) =>
      [...container.querySelectorAll<HTMLImageElement>(selector)].map((i) => i.src)
    expect(srcs('.watch-stage > div > img')).toEqual([poster])
    expect(srcs('.reel-end-art img')).toEqual([poster])
    expect(srcs('.watch-backdrop img')).toEqual([poster])

    // Every candidate flagged: no image anywhere on the stage or behind it; the player waits on
    // paper with the title tile, never on a dark box.
    setFrameFlags({ [testVideo.youtubeId]: 0b1111 })
    try {
      const other = renderAt([`/watch/${testVideo.id}`])
      await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))
      expect(other.container.querySelector('.watch-stage img, .watch-backdrop img')).toBeNull()
      const stage = other.container.querySelector('.watch-stage')
      expect(stage?.querySelector('[data-title-tile]')).toHaveTextContent(testVideo.title)
      expect(stage?.querySelector(':scope > div[aria-hidden]')).toHaveClass('bg-[#faf8f6]')
    } finally {
      setFrameFlags({})
    }
  })

  it('trims very long titles in the tab and steps the heading down', () => {
    const title = 'A very long title about open and distance learning '.repeat(4).trim()
    setCatalog([{ ...testVideo, id: 'long', title }, ...similar])
    renderAt(['/watch/long'])
    // lib/seo keeps the words and drops the suffix when "title · UPOU OER" would not fit.
    expect(document.title).toMatch(/^A very long title .*\S…$/)
    expect(document.title.length).toBeLessThanOrEqual(65)
    expect(screen.getByRole('heading', { level: 1, name: title })).toHaveAttribute('data-long')
  })

  it('saves to My List and shows the copied link state for two seconds', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard(writeText)
    renderAt([`/watch/${testVideo.id}`])

    const save = screen.getByRole('button', { name: 'Save to My List' })
    fireEvent.click(save)
    expect(save).toHaveAttribute('aria-pressed', 'true')
    expect(JSON.parse(localStorage.getItem('upou:my-list') ?? '[]')).toEqual([testVideo.id])

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    expect(screen.getByText('Copied to clipboard')).toBeInTheDocument()

    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByText('Copied to clipboard')).not.toBeInTheDocument()
  })

  it('falls back to a read-only link field when neither clipboard nor share sheet works', async () => {
    setClipboard(() => Promise.reject(new Error('denied')))
    renderAt([`/watch/${testVideo.id}`])

    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    const field = await screen.findByRole('textbox', { name: 'Page link' })
    expect(field).toHaveValue(window.location.href)
    expect(field).toHaveAttribute('readonly')
  })

  it('Back returns to the previous page, or home (replacing the entry) on a direct load', async () => {
    const direct = renderAt([`/watch/${testVideo.id}`])
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(direct.router.state.historyAction).toBe('REPLACE')
    direct.unmount()

    const inApp = renderAt(['/', `/watch/${testVideo.id}`])
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(inApp.router.state.historyAction).toBe('POP')
  })

  it('shows a friendly not-found screen for unknown ids', () => {
    renderAt(['/watch/does-not-exist'])
    expect(screen.getByRole('heading', { name: 'Video not found' })).toBeInTheDocument()
    expect(document.title).toBe('Video not found · UPOU OER')
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'All collections' })).toHaveAttribute(
      'href',
      '/collections',
    )
  })
})
