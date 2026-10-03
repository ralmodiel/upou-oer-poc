import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { slugifyCategory } from '../data/catalog'
import { setCatalog } from '../data/testing'
import { REEL_MS } from '../features/reel/PromoReel'
import { DECODE_CAP_MS } from '../features/reel/preload'
import { testVideo } from '../features/reel/testing'
import { FINE_POINTER_QUERY } from '../lib/pointer'
import WatchPage from './WatchPage'

// Nine look-alikes in the same category, so "Up next" has more than it shows.
const similar = Array.from({ length: 9 }, (_, i) => ({
  ...testVideo,
  id: `similar-${i}`,
  youtubeId: `sim${i}`.padEnd(11, 'x'),
  title: `Similar video ${i}`,
}))

function renderAt(entries: string[], index = entries.length - 1) {
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
    expect(screen.getByRole('region', { name: 'Video player' })).toHaveFocus()
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
    // The collection is named by the breadcrumb, not repeated under the title.
    expect(screen.getAllByText(testVideo.category)).toHaveLength(1)
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

    const upNext = within(screen.getByRole('list', { name: 'Up next' })).getAllByRole('link')
    expect(upNext).toHaveLength(8)
    expect(upNext.map((a) => a.getAttribute('href'))).not.toContain(`/watch/${testVideo.id}`)
    expect(screen.getByRole('link', { name: /More in Technology and Teaching/ })).toHaveAttribute(
      'href',
      slug,
    )
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
