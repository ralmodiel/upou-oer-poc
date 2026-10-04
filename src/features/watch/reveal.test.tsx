import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCatalog } from '../../data/testing'
import WatchPage from '../../pages/WatchPage'
import { DECODE_CAP_MS } from '../reel/preload'
import { testVideo } from '../reel/testing'

// The rules in watch.css that hide the page under the stage (jsdom applies no stylesheets, so the
// test runs their selectors against the page as it renders). Tests run from the repo root.
// Node's fs through the process (the app's types carry no Node typings; tests run in Node).
type Fs = { readFileSync(path: string, encoding: 'utf8'): string }
const node = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): Fs } }).process
const css = node.getBuiltinModule('node:fs').readFileSync('src/features/watch/watch.css', 'utf8')
const hiding = [...css.matchAll(/([^{}]+)\{[^{}]*visibility:\s*hidden[^{}]*\}/g)]
  .map(([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter((selector) => selector.includes('.reel'))
const hidden = () => hiding.flatMap((selector) => [...document.querySelectorAll(selector)])

beforeEach(() => {
  setCatalog([testVideo])
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('the watch page under the stage', () => {
  it('stays hidden while the preview plays and shows once it is skipped', async () => {
    const router = createMemoryRouter([{ path: '/watch/:id', Component: WatchPage }], {
      initialEntries: [`/watch/${testVideo.id}`],
    })
    render(<RouterProvider router={router} />)
    await act(() => vi.advanceTimersByTimeAsync(DECODE_CAP_MS))

    // During the preview: the article with the title (and Up next, below lg) is what is hidden.
    expect(hiding).toHaveLength(2)
    const title = screen.getByRole('heading', { level: 1, name: testVideo.title })
    expect(hidden()).toContain(title.closest('article'))
    expect(hidden()).toContain(document.querySelector('.watch-aside'))

    // Skipped: nothing under the stage is hidden any more.
    fireEvent.click(screen.getByRole('button', { name: /skip preview/i }))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(document.querySelector('.watch-stage .reel')).toBeNull()
    expect(hidden()).toEqual([])
  })
})
