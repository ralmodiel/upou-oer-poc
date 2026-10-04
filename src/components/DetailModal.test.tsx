import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../data/testing'
import DetailModal from './DetailModal'
import { fixtureVideos } from './test-fixtures'

setCatalog(fixtureVideos)

const open = (entry: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/', element: <DetailModal /> }], {
        initialEntries: [entry],
      })}
    />,
  )

it('opens on the still, which plays and grows while focused, with ↓ leading to Play', async () => {
  open('/?v=climate-basics')
  const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
  const still = within(dialog).getByRole('link', { name: 'Play Climate Change Basics' })
  await waitFor(() => expect(still).toHaveFocus())
  expect(still).toHaveAttribute('href', '/watch/climate-basics')
  // The growth hangs off the wrapper (a focused link drops its transition in index.css).
  expect(still.parentElement?.className).toContain('has-[a:focus]:scale-108')
  expect(still).toHaveAttribute('data-spatial', 'over-entry')
  expect(within(dialog).getByRole('link', { name: 'Play' })).toHaveAttribute(
    'data-spatial',
    'entry',
  )
})

it('shows How to cite whole, below the picture and its buttons', async () => {
  open('/?v=climate-basics')
  const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
  const cite = await within(dialog).findByRole('region', { name: 'How to cite' })
  expect(cite).toBeVisible()
  // no citation on its source page: one generated from its details, so labelled
  expect(cite).toHaveTextContent(
    'UP Open University. (2026, May 1). Climate Change Basics [Video]. UPOU Networks, University of the Philippines Open University. https://oer.upou.edu.ph/climate-basics/',
  )
  expect(cite).toHaveTextContent("Generated from this video's details")
  // nothing around it folds, clamps or hides it
  for (let node: Element | null = cite; node; node = node.parentElement) {
    expect(node.tagName).not.toBe('DETAILS')
    for (const attr of ['hidden', 'inert', 'aria-hidden', 'data-folded'])
      expect(node.hasAttribute(attr), `${node.tagName} [${attr}]`).toBe(false)
    expect(node.className).not.toMatch(/line-clamp|truncate|max-h-(?!none)|sr-only/)
  }
  const play = within(dialog).getByRole('link', { name: 'Play' })
  const title = within(dialog).getByRole('heading', { level: 2, name: 'Climate Change Basics' })
  expect(play.compareDocumentPosition(cite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(cite.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('opened from the hero Details (#details), starts on the details', async () => {
  open('/?v=climate-basics#details')
  const dialog = screen.getByRole('dialog', { name: 'Climate Change Basics' })
  const details = within(dialog).getByRole('group', { name: 'Climate Change Basics' })
  await waitFor(() => expect(details).toHaveFocus())
  expect(details).toHaveAttribute('tabindex', '-1')
  expect(within(details).getByText('About Climate Change Basics.')).toBeVisible()
  const cite = await within(dialog).findByRole('region', { name: 'How to cite' })
  expect(cite).toBeVisible()
  expect(cite).toHaveTextContent('Climate Change Basics [Video].')
})

describe('the floating More like this pill', () => {
  // Observers by target, so a test can say whether the More like this heading is in view.
  const observers: { cb: IntersectionObserverCallback; el?: Element }[] = []
  class FakeObserver {
    entry: { cb: IntersectionObserverCallback; el?: Element }
    constructor(cb: IntersectionObserverCallback) {
      this.entry = { cb }
      observers.push(this.entry)
    }
    observe(el: Element) {
      this.entry.el = el
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  const headingInView = (inView: boolean) => {
    const watcher = observers.find((o) => o.el?.textContent === 'More like this')
    expect(watcher).toBeDefined()
    const entry = {
      isIntersecting: inView,
      boundingClientRect: { top: inView ? 300 : 900 },
      rootBounds: { top: 0 },
    } as unknown as IntersectionObserverEntry
    act(() => watcher!.cb([entry], {} as IntersectionObserver))
  }
  const pill = () => screen.queryByRole('button', { name: 'More like this' })

  afterEach(() => {
    observers.length = 0
    vi.unstubAllGlobals()
    setCatalog(fixtureVideos)
  })

  it('shows while the heading is below the view and hides once it is in view', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    open('/?v=climate-basics')
    expect(pill()).toBeNull() // nothing until the observer says so
    headingInView(false)
    expect(pill()).toBeVisible()
    expect(screen.getByRole('dialog')).toHaveClass('scroll-pb-24')
    headingInView(true)
    expect(pill()).toBeNull()
    expect(screen.getByRole('dialog')).not.toHaveClass('scroll-pb-24')
  })

  it('never shows without More like this', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    setCatalog(fixtureVideos.slice(0, 1))
    open('/?v=climate-basics')
    expect(screen.queryByRole('region', { name: 'More like this' })).toBeNull()
    expect(observers.some((o) => o.el?.textContent === 'More like this')).toBe(false)
    expect(pill()).toBeNull()
  })

  it('scrolls to More like this and, from a keyboard, onto its first card', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    open('/?v=climate-basics')
    headingInView(false)
    fireEvent.click(pill()!, { detail: 0 }) // Enter or a remote's OK
    const similar = screen.getByRole('region', { name: 'More like this' })
    expect(scrollIntoView.mock.contexts[0]).toBe(similar)
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
    expect(within(similar).getAllByRole('link')[0]).toHaveFocus()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })
})
