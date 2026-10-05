import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateCite } from '../../data/cites'
import type { Video } from '../../types'
import { testVideo } from '../reel/testing'
import WatchCite from './WatchCite'

// The crawled citations: a stand-in table the tests fill (cites.ts keeps a reference to it).
const crawled = vi.hoisted((): Record<string, string> => ({}))
vi.mock('../../data/cites.json', () => ({ default: crawled }))

const URL = 'https://oer.upou.edu.ph/space/'
const CITE = `Cervera, F. (2026, August 19). Towards Space Humanities [Video]. UPOU Networks, University of the Philippines Open University. ${URL}`
const video: Video = { ...testVideo, id: 'space', sourceUrl: URL }

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
}

async function renderCite(cite: string | undefined, as?: 'h2' | 'h3') {
  for (const key of Object.keys(crawled)) delete crawled[key]
  if (cite) crawled.space = cite
  const view = render(<WatchCite video={video} as={as} />)
  await screen.findByRole('region', { name: 'How to cite' }) // cites.json loads on demand
  return view
}

describe('WatchCite', () => {
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('generates a citation from the video when its page has none, and says so', async () => {
    await renderCite(undefined)
    const section = screen.getByRole('region', { name: 'How to cite' })
    expect(section).toHaveTextContent(generateCite(video))
    expect(section).not.toHaveTextContent('Generated')
    expect(screen.getByRole('link', { name: `${URL} (opens in a new tab)` })).toBeInTheDocument()
  })

  it('shows the whole crawled citation under its heading, its URL as a link, no note', async () => {
    await renderCite(CITE)
    expect(screen.getByRole('heading', { level: 2, name: /How to cite/ })).toBeInTheDocument()
    const section = screen.getByRole('region', { name: 'How to cite' })
    expect(section).toHaveTextContent(CITE)
    expect(screen.queryByText(/Generated from/)).toBeNull()
    const link = screen.getByRole('link', { name: `${URL} (opens in a new tab)` })
    expect(link).toHaveAttribute('href', URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull()
  })

  it('on portrait phones, opens from its link: citation and Copy shown on a tap', async () => {
    await renderCite(CITE)
    const toggle = screen.getByRole('button', { name: 'How to cite' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const shut = (el: Element) => el.className.includes('max-sm:portrait:hidden')
    const text = [...document.querySelectorAll('p')].find((p) => p.textContent === CITE)!
    expect(shut(text)).toBe(true)
    expect(shut(screen.getByRole('button', { name: 'Copy citation' }))).toBe(true)
    act(() => toggle.click())
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(shut(text)).toBe(false)
    expect(shut(screen.getByRole('button', { name: 'Copy citation' }))).toBe(false)
  })

  it('never folds, clamps or hides the citation', async () => {
    for (const cite of [CITE, undefined]) {
      const { container, unmount } = await renderCite(cite)
      const full = cite ?? generateCite(video)
      const text = [...container.querySelectorAll('p')].find((p) => p.textContent === full)
      expect(text).toBeDefined()
      expect(text).toBeVisible()
      for (let node: Element | null = text!; node; node = node.parentElement) {
        expect(node.tagName).not.toBe('DETAILS')
        for (const attr of ['hidden', 'inert', 'aria-hidden', 'data-folded'])
          expect(node.hasAttribute(attr), `${node.tagName} [${attr}]`).toBe(false)
        expect(node.className).not.toMatch(
          /line-clamp|truncate|text-ellipsis|max-h-|overflow-hidden|\bh-\d|sr-only/,
        )
        expect((node as HTMLElement).style.maxHeight).toBe('')
      }
      unmount()
    }
  })

  it('keeps a closing full stop out of the link and lines apart', async () => {
    await renderCite(`First (2026). https://example.org/a.\nSecond (2026). ${URL}`)
    expect(screen.getByRole('link', { name: /example\.org/ })).toHaveAttribute(
      'href',
      'https://example.org/a',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('takes a heading level for the quick look', async () => {
    await renderCite(CITE, 'h3')
    expect(screen.getByRole('heading', { level: 3, name: /How to cite/ })).toBeInTheDocument()
  })

  it('copies the citation and says Copied for two seconds', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    setClipboard(writeText)
    await renderCite(CITE)
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy citation' }))
    })
    expect(writeText).toHaveBeenCalledWith(CITE)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Citation copied to clipboard')
    act(() => vi.advanceTimersByTime(1900))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByRole('button', { name: 'Copy citation' })).toBeInTheDocument()
  })

  it('selects the citation for copying by hand without a clipboard', async () => {
    await renderCite(CITE)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy citation' }))
    })
    expect(window.getSelection()?.toString()).toBe(CITE)
    expect(screen.getByRole('status')).toHaveTextContent(/press Ctrl\+C/)
    expect(screen.getByRole('button', { name: 'Copy citation' })).toBeInTheDocument()
  })
})
