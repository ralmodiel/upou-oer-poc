import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../data/testing'
import Featured, { ADVANCE_MS, HOVER_INTENT_MS } from './Featured'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

const featured = fixtureVideos.slice(0, 3)
const alsoNew = fixtureVideos.slice(3, 6)

function renderHome() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <main>
            <Featured videos={featured} alsoNew={alsoNew} />
            <section aria-label="Below" className="lazy-section" />
            <footer />
          </main>
        ),
      },
      { path: '/watch/:id', element: <p>Player</p> },
      // A fresh history entry per test: the hero remembers its video per entry (Back), and a memory
      // router's first entry always has the key "default".
    ],
    { initialEntries: ['/watch/start', '/'], initialIndex: 1 },
  )
  return { ...render(<RouterProvider router={router} />), router }
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const heroPlays = () => screen.getByRole('link', { name: 'Play' }).getAttribute('href')
const row = () => screen.getByRole('region', { name: 'Featured videos' })
const card = (i: number) => within(row()).getAllByRole('listitem')[i]
const cardLink = (i: number) => within(card(i)).getByRole('link', { name: /^Play / })
const cue = () => screen.getByRole('button', { name: 'More video resources below' })
const href = (i: number) => `/watch/${featured[i].id}`

describe('Featured hero and row', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens on the first video, with every featured video in the first row, then Also new', () => {
    renderHome()
    expect(heroPlays()).toBe(href(0))
    expect(within(row()).getAllByRole('listitem')).toHaveLength(3)
    expect(card(0)).toHaveAttribute('data-active')
    const rows = [...document.querySelectorAll('section')]
      .filter((s) => s.querySelector('[data-row]'))
      .map((s) => s.getAttribute('aria-label') ?? s.querySelector('h2')?.textContent)
    expect(rows).toEqual(['Featured videos', 'Also new'])
    expect(screen.queryByRole('button', { name: /next|previous/i })).toBeNull()
  })

  it('heads the hero details with Featured, then the collection and the title', () => {
    renderHome()
    const hero = screen.getByRole('region', { name: 'Featured' })
    const order = [...hero.querySelectorAll('h2, .eyebrow, h3')].map((el) => el.textContent)
    expect(order).toEqual(['Featured', featured[0].category, featured[0].title])
  })

  it('moves on to the next video after 7 s left alone, round to the first', () => {
    expect(ADVANCE_MS).toBe(7000)
    renderHome()
    wait(6750)
    expect(heroPlays()).toBe(href(0))
    wait(250)
    expect(heroPlays()).toBe(href(1))
    expect(card(1)).toHaveAttribute('data-active')
    expect(card(0)).not.toHaveAttribute('data-active')
    wait(ADVANCE_MS * 2)
    expect(heroPlays()).toBe(href(0))
  })

  it('counts afresh after a key press or a click', () => {
    renderHome()
    wait(5000)
    fireEvent.keyDown(window, { key: 'Shift' })
    wait(6750)
    expect(heroPlays()).toBe(href(0))
    fireEvent.pointerDown(document.body)
    wait(6750)
    expect(heroPlays()).toBe(href(0))
    wait(250)
    expect(heroPlays()).toBe(href(1))
  })

  it('waits while the pointer is over the hero or the row', () => {
    const { container } = renderHome()
    const zone = container.querySelector('[data-featured-zone]')!
    fireEvent.pointerEnter(zone)
    wait(ADVANCE_MS * 3)
    expect(heroPlays()).toBe(href(0))
    fireEvent.pointerLeave(zone)
    wait(ADVANCE_MS)
    expect(heroPlays()).toBe(href(1))
  })

  it('waits while focus is in it, or the tab is hidden', () => {
    renderHome()
    act(() => screen.getByRole('link', { name: 'Play' }).focus())
    wait(ADVANCE_MS * 2)
    expect(heroPlays()).toBe(href(0))
    act(() => screen.getByRole('link', { name: 'Play' }).blur())
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    wait(ADVANCE_MS * 2)
    expect(heroPlays()).toBe(href(0))
    hidden.mockRestore()
    wait(ADVANCE_MS)
    expect(heroPlays()).toBe(href(1))
  })

  it('shows a card under a resting pointer after the intent delay, and keeps it on leaving', () => {
    const { container } = renderHome()
    const zone = container.querySelector('[data-featured-zone]')!
    fireEvent.pointerEnter(zone)
    fireEvent.pointerOver(cardLink(2))
    wait(HOVER_INTENT_MS - 50)
    expect(heroPlays()).toBe(href(0))
    wait(50)
    expect(heroPlays()).toBe(href(2))
    expect(card(2)).toHaveAttribute('data-active')
    fireEvent.pointerLeave(zone)
    wait(ADVANCE_MS - 250)
    expect(heroPlays()).toBe(href(2))
    wait(250)
    expect(heroPlays()).toBe(href(0))
  })

  it('keeps focus on the hero control in focus when a resting pointer shows another video', () => {
    const { container } = renderHome()
    screen.getByRole('link', { name: 'Play' }).focus()
    fireEvent.pointerEnter(container.querySelector('[data-featured-zone]')!)
    fireEvent.pointerOver(cardLink(2))
    wait(HOVER_INTENT_MS)
    expect(heroPlays()).toBe(href(2))
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Play' }))
  })

  it('drops a pick when the pointer sweeps on before the intent delay', () => {
    renderHome()
    fireEvent.pointerOver(cardLink(1))
    wait(HOVER_INTENT_MS / 2)
    fireEvent.pointerOver(cardLink(2))
    wait(HOVER_INTENT_MS)
    expect(heroPlays()).toBe(href(2))
  })

  it('shows the card in focus (keyboard or remote), following the focus along the row', () => {
    renderHome()
    act(() => cardLink(1).focus())
    wait(0)
    expect(heroPlays()).toBe(href(1))
    act(() => cardLink(2).focus())
    wait(0)
    expect(heroPlays()).toBe(href(2))
  })

  it('comes Back on the video it was left from, not the first', async () => {
    const { router } = renderHome()
    act(() => cardLink(2).focus())
    wait(0)
    fireEvent.click(screen.getByRole('link', { name: 'Play' }))
    expect(router.state.location.pathname).toBe(href(2))
    await act(() => router.navigate(-1))
    expect(heroPlays()).toBe(href(2))
    expect(card(2)).toHaveAttribute('data-active')
  })

  it('plays a card when it is clicked, as cards do elsewhere', () => {
    const { router } = renderHome()
    fireEvent.click(cardLink(1))
    expect(router.state.location.pathname).toBe(href(1))
  })
})

describe('More video resources below', () => {
  let footerSeen: (visible: boolean) => void = () => {}
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          footerSeen = (visible) => act(() => cb([{ isIntersecting: visible }]))
        }
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const shownCue = () => !cue().closest('[data-more-below]')!.hasAttribute('data-hidden')

  it('shows from the start, stays on scrolling, and hides only while the footer is in view', () => {
    renderHome()
    expect(shownCue()).toBe(true)
    fireEvent.scroll(window)
    fireEvent.wheel(window)
    expect(shownCue()).toBe(true)
    footerSeen(true)
    expect(shownCue()).toBe(false)
    footerSeen(false)
    expect(shownCue()).toBe(true)
  })

  it('steps aside while it would cover the card in focus', () => {
    renderHome()
    const pill = cue()
    vi.spyOn(pill, 'getBoundingClientRect').mockReturnValue({ top: 700, bottom: 740 } as DOMRect)
    const article = cardLink(1).closest('article')!
    vi.spyOn(article, 'getBoundingClientRect').mockReturnValue({ top: 500, bottom: 760 } as DOMRect)
    act(() => cardLink(1).focus())
    expect(shownCue()).toBe(false)
    act(() => screen.getByRole('link', { name: 'Play' }).focus())
    expect(shownCue()).toBe(true)
  })

  it('steps down to the next row below the top one with each press, never playing a card', () => {
    const nameOf = (el: HTMLElement) =>
      el.getAttribute('aria-label') ?? el.querySelector('h2')?.textContent ?? ''
    const tops: Record<string, number> = { 'Featured videos': 300, 'Also new': 700, Below: 1100 }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return { top: tops[nameOf(this)] ?? 0 } as DOMRect
    })
    const scrolled: string[] = []
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      const name = nameOf(this)
      scrolled.push(name)
      // That row now rests at the top; the others move up with it.
      const by = tops[name]
      for (const key of Object.keys(tops)) tops[key] -= by
    }
    const { router } = renderHome()
    fireEvent.click(cue())
    fireEvent.click(cue())
    fireEvent.click(cue())
    expect(scrolled).toEqual(['Featured videos', 'Also new', 'Below'])
    expect(router.state.location.pathname).toBe('/')
  })
})
