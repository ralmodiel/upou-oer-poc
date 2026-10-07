// The page shells paint chrome.mjs until the app mounts and replaces it with the real header and
// tab bar, so the two must be the same markup: any change to Header.tsx fails here until chrome.mjs
// follows. Each variant (Help label from 64rem, theme icon) is compared as the app renders it.
/* global window, document */
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { createElement, Fragment } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import Header, { TabBar } from '../../src/components/Header'
import { fixtureVideos } from '../../src/components/test-fixtures'
import { setCatalog } from '../../src/data/testing'
import { THEME_KEY, readStoredTheme, resolveTheme } from '../../src/lib/theme'
import { chromeMarkup } from './chrome.mjs'

setCatalog(fixtureVideos)

// Live media queries: useMediaQuery caches each list, so `wide` is read on every check.
const media = { wide: false }
const realMatchMedia = window.matchMedia
afterEach(() => {
  media.wide = false
  window.matchMedia = realMatchMedia
})
const stubMedia = () => {
  window.matchMedia = (query) => ({
    get matches() {
      return query === '(min-width: 64rem)' && media.wide
    },
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}

// Names and ids the shell can't know (useId, the theme button's current state) don't paint.
const normalize = (html) =>
  html
    .replace(/ (id|for|aria-controls)="[^"]*"/g, ' $1=""')
    .replace(/ (aria-label|title)="(Theme: [^"]*|Switch theme)"/g, ' $1=""')

/** chromeMarkup as the app would render it for one variant: the other variant's copies dropped. */
function variant(html, { wide, dark }) {
  const keep = new Set([wide ? 'wide' : 'narrow', dark ? 'dark' : 'light'])
  const t = document.createElement('template')
  t.innerHTML = html
  for (const el of t.content.querySelectorAll('[data-shell]')) {
    if (!keep.has(el.dataset.shell)) el.remove()
    else if (el.tagName === 'SPAN') el.replaceWith(...el.childNodes)
    else {
      el.removeAttribute('data-shell')
      el.removeAttribute('class')
    }
  }
  return t.innerHTML
}

function appMarkup(path, { wide, dark }) {
  media.wide = wide
  stubMedia()
  if (dark) localStorage.setItem(THEME_KEY, JSON.stringify('dark'))
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: createElement(Fragment, null, createElement(Header), createElement(TabBar)),
      },
    ],
    { initialEntries: [path] },
  )
  const { container, unmount } = render(createElement(RouterProvider, { router }))
  const html = container.innerHTML
  unmount()
  return html
}

describe('tools/seo/chrome.mjs', () => {
  const pages = [
    ['/', 'home'],
    ['/collections', 'collections'],
    ['/collections/arts', 'collections'],
    ['/my-list', 'my-list'],
    ['/watch/some-video', null],
  ]
  for (const [path, section] of pages)
    for (const wide of [false, true])
      for (const dark of [false, true])
        it(`matches the app's header and tab bar on ${path} (${wide ? 'wide' : 'narrow'}, ${dark ? 'dark' : 'light'})`, () => {
          const shell = variant(chromeMarkup('/', section), { wide, dark })
          expect(normalize(shell)).toBe(normalize(appMarkup(path, { wide, dark })))
        })

  it('links under the base path as the router does', () => {
    const html = chromeMarkup('/upou-oer-poc/', 'collections')
    expect(html).toContain('href="/upou-oer-poc" data-discover')
    expect(html).toContain('aria-current="page" class="relative')
    expect(html).toContain('href="/upou-oer-poc/collections"')
    expect(html).not.toContain('href="/upou-oer-poc//')
  })

  // public/theme-boot.js runs before the app; it must land on the theme the app's bootstrap picks.
  it('theme-boot.js puts the theme the app resolves on <html>', () => {
    const boot = new Function(readFileSync('public/theme-boot.js', 'utf8'))
    for (const [stored, systemDark] of [
      [undefined, false],
      [undefined, true],
      ['dark', false],
      ['light', true],
      ['system', true],
      ['bogus', false],
    ]) {
      localStorage.clear()
      if (stored) localStorage.setItem(THEME_KEY, JSON.stringify(stored))
      window.matchMedia = (query) => ({ matches: systemDark && query.includes('dark') })
      delete document.documentElement.dataset.theme
      boot()
      expect(document.documentElement.dataset.theme).toBe(resolveTheme(readStoredTheme()))
    }
    localStorage.setItem(THEME_KEY, '{not json')
    boot()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
