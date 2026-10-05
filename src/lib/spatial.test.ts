import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  candidates,
  distance,
  findSection,
  findTarget,
  focusAndReveal,
  keepsArrow,
  moveFocus,
  useSpatialNavigation,
} from './spatial'

// [top, left, width, height] in viewport pixels.
type Rect = [number, number, number, number]

function place(selector: string, [top, left, width, height]: Rect) {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(`missing ${selector}`)
  el.getBoundingClientRect = () =>
    ({ top, left, width, height, right: left + width, bottom: top + height }) as DOMRect
  return el
}

// Header row, a 2 x 2 card grid (stretched links with roving tabindex) and a footer link.
function page() {
  document.body.innerHTML = `
    <header>
      <a id="home" href="/">Home</a>
      <a id="browse" href="/browse">Browse</a>
      <input id="q" type="search" />
      <button id="theme">Theme</button>
    </header>
    <main id="main" tabindex="-1">
      <ul>
        <li><article id="a1"><a id="a1-link" href="/w/1" data-card-link tabindex="0">One</a>
          <button id="a1-save" tabindex="-1">Save</button>
          <a id="a1-ghost" href="/w/1" aria-hidden="true" tabindex="-1">ghost</a></article></li>
        <li><article id="a2"><a id="a2-link" href="/w/2" data-card-link tabindex="-1">Two</a></article></li>
        <li><article id="b1"><a id="b1-link" href="/w/3" data-card-link tabindex="-1">Three</a></article></li>
        <li><article id="b2"><a id="b2-link" href="/w/4" data-card-link tabindex="-1">Four</a>
          <button id="b2-off" disabled>Off</button>
          <button id="b2-skip" data-spatial="skip">Skip me</button></article></li>
      </ul>
    </main>
    <footer><a id="foot" href="/about">About</a><a id="sr" href="#x">Skip link</a></footer>`
  place('#home', [10, 10, 80, 30])
  place('#browse', [10, 200, 60, 30])
  place('#q', [10, 600, 200, 30])
  place('#theme', [10, 900, 40, 40])
  place('#main', [60, 0, 1024, 800])
  place('#a1', [100, 10, 300, 200])
  place('#a1-link', [230, 10, 280, 20])
  place('#a1-save', [270, 10, 60, 30])
  place('#a1-ghost', [100, 320, 10, 10])
  place('#a2', [100, 330, 300, 200])
  place('#a2-link', [230, 330, 280, 20])
  place('#b1', [340, 10, 300, 200])
  place('#b1-link', [470, 10, 280, 20])
  place('#b2', [340, 330, 300, 200])
  place('#b2-link', [470, 330, 280, 20])
  place('#b2-off', [510, 330, 60, 30])
  place('#b2-skip', [510, 400, 60, 30])
  place('#foot', [600, 10, 100, 20])
  place('#sr', [0, 0, 1, 1])
}

const id = (el: Element | null | undefined) => el?.id ?? null
const focus = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('distance', () => {
  const from = { top: 100, left: 100, bottom: 200, right: 200 }
  it('rejects targets that do not lie in the direction', () => {
    expect(distance(from, { top: 150, left: 100, bottom: 250, right: 200 }, 'down')).toBeNull()
    expect(distance(from, { top: 0, left: 100, bottom: 50, right: 200 }, 'down')).toBeNull()
    expect(distance(from, { top: 250, left: 100, bottom: 300, right: 200 }, 'down')).toBe(50)
    expect(distance(from, { top: 0, left: 100, bottom: 50, right: 200 }, 'up')).toBe(50)
  })
  it('prefers an aligned target over a nearer one off to the side', () => {
    const aligned = distance(from, { top: 260, left: 100, bottom: 300, right: 200 }, 'down')
    const offset = distance(from, { top: 210, left: 260, bottom: 250, right: 360 }, 'down')
    expect(aligned).toBeLessThan(offset!)
  })
})

describe('candidates', () => {
  it('include roving items but not hidden, disabled, skipped or container elements', () => {
    page()
    const ids = candidates().map(id)
    expect(ids).toEqual(
      expect.arrayContaining(['home', 'q', 'theme', 'a1-link', 'a1-save', 'a2-link', 'foot']),
    )
    expect(ids).not.toContain('main')
    expect(ids).not.toContain('a1-ghost')
    expect(ids).not.toContain('b2-off')
    expect(ids).not.toContain('b2-skip')
  })
})

describe('findTarget', () => {
  it('moves card by card through a grid, using the whole card as the shape', () => {
    page()
    focus('#a1-link')
    expect(id(findTarget('right'))).toBe('a2-link')
    expect(id(findTarget('up'))).toBe('browse')
    expect(findTarget('left')).toBeNull()
    focus('#b2-link')
    expect(id(findTarget('left'))).toBe('b1-link')
    expect(id(findTarget('up'))).toBe('a2-link')
    expect(id(findTarget('down'))).toBe('foot')
  })

  it('reaches a button inside a text field’s right padding (Clear search) both ways', () => {
    document.body.innerHTML = `
      <input id="q" type="search" value="gender" style="padding-right: 40px" />
      <button id="clear">Clear</button>
      <button id="theme">Theme</button>`
    place('#q', [12, 1294, 320, 40])
    place('#clear', [16, 1578, 32, 32])
    place('#theme', [12, 1626, 40, 40])
    const q = document.querySelector<HTMLInputElement>('#q')!
    q.focus()
    q.setSelectionRange(6, 6)
    expect(id(findTarget('right'))).toBe('clear')
    focus('#clear')
    expect(id(findTarget('left'))).toBe('q')
    expect(id(findTarget('right'))).toBe('theme')
  })

  it('leaves a card with one ↓ from its link; ↑ straight after comes back to its Save', () => {
    page()
    focus('#a1-link')
    expect(id(findTarget('down'))).toBe('b1-link')
    expect(moveFocus('down')).toBe(true)
    expect(document.activeElement?.id).toBe('b1-link')
    expect(id(findTarget('up'))).toBe('a1-save')
    expect(moveFocus('up')).toBe(true)
    expect(document.activeElement?.id).toBe('a1-save')
    // From its Save: the link above, the next card beside, the next row below.
    expect(id(findTarget('up'))).toBe('a1-link')
    expect(id(findTarget('right'))).toBe('a2-link')
    expect(id(findTarget('down'))).toBe('b1-link')
    // Only straight after: after any other move, ↑ lands on the card again.
    focus('#a1-link')
    expect(moveFocus('down')).toBe(true)
    expect(moveFocus('right')).toBe(true)
    expect(moveFocus('left')).toBe(true)
    expect(id(findTarget('up'))).toBe('a1-link')
  })

  it('reaches a centred "wide" row control straight down from any column', () => {
    page()
    document
      .querySelector('ul')!
      .insertAdjacentHTML(
        'afterend',
        '<div id="row"><button id="more" data-spatial="wide">More</button></div><a id="far" href="/f">Far</a>',
      )
    place('#row', [560, 10, 620, 40])
    place('#more', [560, 280, 80, 40])
    // Aligned with the right column but further down: loses to the wide row.
    place('#far', [700, 330, 100, 20])
    focus('#b2-link')
    expect(id(findTarget('down'))).toBe('more')
  })

  it('reaches controls scrolled out of view inside a (fixed) dialog', () => {
    document.body.innerHTML =
      '<dialog open style="position: fixed"><button id="close">Close</button><a id="facts" href="/c">General</a></dialog>'
    place('#close', [-60, 900, 40, 40])
    place('#facts', [20, 500, 120, 40])
    focus('#facts')
    expect(id(findTarget('up'))).toBe('close')
  })

  it('prefers page content over a sticky bar, which is the fallback', () => {
    page()
    document.querySelector('header')!.style.position = 'sticky'
    document
      .querySelector('ul')!
      .insertAdjacentHTML('beforebegin', '<a id="chip" href="/c">Chip</a>')
    // The chip row is scrolled out above the viewport, under the header.
    place('#chip', [-40, 10, 80, 30])
    focus('#a1-link')
    expect(id(findTarget('up'))).toBe('chip')
    document.getElementById('chip')!.remove()
    expect(id(findTarget('up'))).toBe('browse')
    // Still scrolling out from under the bar: the bar is the fallback all the same.
    place('#a1', [30, 10, 300, 200])
    expect(id(findTarget('up'))).toBe('browse')
    place('#a1', [100, 10, 300, 200])
    // From the bar itself only what is on screen counts, and the bar's own items come first:
    // ← from the field stays in the bar although a card lies just below-left.
    focus('#browse')
    expect(id(findTarget('down'))).toBe('a1-link')
    place('#a2', [45, 330, 300, 200])
    focus('#q')
    expect(id(findTarget('left'))).toBe('browse')
  })

  it('keeps aside controls to their bar, ← / → off the bars, ↓ from the bar on the entry', () => {
    page()
    document.querySelector('header')!.style.position = 'sticky'
    document.getElementById('theme')!.dataset.spatial = 'aside'
    // ↑ from the right-hand card passes the theme button (aside) for the search field.
    focus('#a2-link')
    expect(id(findTarget('up'))).toBe('q')
    focus('#q')
    expect(id(findTarget('right'))).toBe('theme')
    // A start scrolled up under the header still finds the header above it.
    place('#a2', [-300, 330, 300, 200])
    focus('#a2-link')
    expect(id(findTarget('up'))).toBe('q')
    place('#a2', [100, 330, 300, 200])
    // Nothing to the right of the footer link: no move, not a jump into the header.
    place('#foot', [600, 700, 100, 20])
    focus('#foot')
    expect(findTarget('right')).toBeNull()
    // From the focused skip link (fixed: a bar of its own), → reaches the header, not the page.
    const skip = document.getElementById('sr')!
    skip.style.position = 'fixed'
    place('#sr', [60, 0, 5, 20])
    focus('#sr')
    expect(id(findTarget('right'))).toBe('home')
    // ↓ from any bar item lands on the on-screen entry control (the hero's Play).
    document.getElementById('b2-link')!.dataset.spatial = 'entry'
    focus('#theme')
    expect(id(findTarget('down'))).toBe('b2-link')
    focus('#home')
    expect(id(findTarget('down'))).toBe('b2-link')
  })

  it('leaves a text field up or down, towards the overlapping column', () => {
    page()
    focus('#q')
    expect(id(findTarget('down'))).toBe('a2-link')
    expect(id(findTarget('left'))).toBe('browse')
  })

  it('starts from the top-left corner of a focused container or of the viewport', () => {
    page()
    focus('#main')
    expect(id(findTarget('down'))).toBe('a1-link')
    ;(document.activeElement as HTMLElement).blur()
    expect(id(findTarget('down'))).toBe('home')
    expect(id(findTarget('right'))).toBe('home')
  })

  it('enters a focused container up or down, and leaves it sideways as a whole', () => {
    document.body.innerHTML = `
      <main>
        <div id="stage" tabindex="-1"><button id="play">Play</button></div>
        <a id="next" href="/w/2">Next</a>
      </main>`
    place('#stage', [100, 0, 600, 340])
    place('#play', [110, 10, 60, 30])
    place('#next', [100, 640, 200, 100])
    focus('#stage')
    expect(id(findTarget('down'))).toBe('play')
    expect(id(findTarget('right'))).toBe('next')
  })

  it('stays inside an open dialog', () => {
    page()
    document.body.insertAdjacentHTML(
      'beforeend',
      '<dialog open tabindex="-1"><button id="d1">A</button><button id="d2">B</button></dialog>',
    )
    place('#d1', [300, 300, 80, 40])
    place('#d2', [300, 400, 80, 40])
    focus('#d1')
    expect(id(findTarget('right'))).toBe('d2')
    expect(findTarget('down')).toBeNull()
    expect(findTarget('up')).toBeNull()
  })
})

describe('chip groups', () => {
  // A Play button, two wrapped rows of chips (c1 c2 c3 / c4; c2 is the tab stop) and a card.
  function chipsPage(tabStop = true) {
    const tab = (on: boolean) => (tabStop ? `tabindex="${on ? 0 : -1}"` : '')
    document.body.innerHTML = `
      <main>
        <button id="play">Play</button>
        <ul id="chips" data-spatial="group">
          <li><a id="c1" href="/c/1" ${tab(false)}>One</a></li>
          <li><a id="c2" href="/c/2" ${tab(true)}>Two</a></li>
          <li><a id="c3" href="/c/3" ${tab(false)} aria-current="true">Three</a></li>
          <li><a id="c4" href="/c/4" ${tab(false)}>Four</a></li>
        </ul>
        <article id="k1"><a id="k1-link" href="/w/1" data-card-link>Card</a></article>
      </main>`
    place('#play', [0, 10, 100, 40])
    place('#chips', [100, 10, 600, 100])
    place('#c1', [100, 10, 100, 40])
    place('#c2', [100, 120, 100, 40])
    place('#c3', [100, 230, 100, 40])
    place('#c4', [160, 10, 100, 40])
    place('#k1', [260, 10, 300, 200])
    place('#k1-link', [390, 10, 280, 20])
  }

  it('is one stop for ↑ / ↓, entered at its tab stop', () => {
    chipsPage()
    focus('#play')
    expect(id(findTarget('down'))).toBe('c2')
    focus('#c1')
    expect(id(findTarget('down'))).toBe('k1-link')
    focus('#k1-link')
    expect(id(findTarget('up'))).toBe('c2')
    focus('#c4')
    expect(id(findTarget('up'))).toBe('play')
  })

  it('walks its chips in order with ← / →, row after row', () => {
    chipsPage()
    focus('#c2')
    expect(id(findTarget('right'))).toBe('c3')
    focus('#c3')
    expect(id(findTarget('right'))).toBe('c4')
    expect(id(findTarget('left'))).toBe('c2')
    focus('#c4')
    expect(findTarget('right')).toBeNull()
  })

  it('without a tab stop, is entered at its active chip', () => {
    chipsPage(false)
    focus('#play')
    expect(id(findTarget('down'))).toBe('c3')
  })
})

describe('lists and heading links', () => {
  // Play, a grouped list of two cards, then a section whose See all link sits beside its heading.
  function listPage() {
    document.body.innerHTML = `
      <main>
        <button id="play">Play</button>
        <ol id="list" data-spatial="group">
          <li><article id="n1"><a id="n1-link" href="/w/1" data-card-link>One</a></article></li>
          <li><article id="n2"><a id="n2-link" href="/w/2" data-card-link>Two</a></article></li>
        </ol>
        <section id="s">
          <h2>Section</h2>
          <a id="all" href="/c/s" data-spatial="heading">See all</a>
          <article id="k1"><a id="k1-link" href="/w/3" data-card-link>Three</a></article>
          <article id="k2"><a id="k2-link" href="/w/4" data-card-link>Four</a></article>
        </section>
      </main>`
    place('#play', [0, 10, 100, 40])
    place('#list', [60, 0, 360, 200])
    place('#n1', [60, 0, 360, 100])
    place('#n1-link', [70, 140, 200, 20])
    place('#n2', [160, 0, 360, 100])
    place('#n2-link', [170, 140, 200, 20])
    place('#s', [300, 0, 360, 400])
    place('#all', [330, 260, 90, 40])
    place('#k1', [400, 10, 160, 200])
    place('#k1-link', [530, 10, 150, 20])
    place('#k2', [400, 190, 160, 200])
    place('#k2-link', [530, 190, 150, 20])
  }

  it('enters a list at its first item and leaves it with the next ↓', () => {
    listPage()
    focus('#play')
    expect(id(findTarget('down'))).toBe('n1-link')
    focus('#n1-link')
    expect(id(findTarget('right'))).toBe('n2-link')
    expect(id(findTarget('down'))).toBe('k1-link')
  })

  it('passes over a heading link from outside its section, reaches it from inside', () => {
    listPage()
    focus('#n2-link')
    expect(id(findTarget('down'))).toBe('k1-link')
    focus('#k2-link')
    expect(id(findTarget('up'))).toBe('all')
    // With nothing else that way, the link is still reached.
    document.querySelectorAll('article').forEach((a) => a.remove())
    focus('#play')
    expect(id(findTarget('down'))).toBe('all')
  })
})

describe('scrolling lists', () => {
  // A link above, a list of six rows that shows three (rows 4-6 lie below its box, clipped, where
  // the More button and a side link are drawn), then More under the list.
  function scrollPage() {
    document.body.innerHTML = `
      <main>
        <a id="above" href="/a">Above</a>
        <ol id="list" data-spatial="list">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<li><a id="r${n}" href="/w/${n}">Row ${n}</a></li>`).join('')}
        </ol>
        <button id="more">More…</button>
        <a id="side" href="/s">Side</a>
      </main>`
    place('#above', [0, 0, 300, 40])
    place('#list', [60, 0, 300, 300])
    for (let n = 1; n <= 6; n++) place(`#r${n}`, [60 + (n - 1) * 100, 0, 300, 100])
    place('#more', [370, 0, 300, 40])
    place('#side', [460, 400, 100, 40])
  }

  it('walks every row with ↓, those out of view included, then reaches More', () => {
    scrollPage()
    focus('#r3')
    expect(id(findTarget('down'))).toBe('r4')
    focus('#r6')
    expect(id(findTarget('down'))).toBe('more')
    expect(id(findTarget('up'))).toBe('r5')
  })

  it('is entered at its last row from below and its first from above', () => {
    scrollPage()
    focus('#more')
    expect(id(findTarget('up'))).toBe('r6')
    focus('#above')
    expect(id(findTarget('down'))).toBe('r1')
  })

  it('offers only rows in view from the side', () => {
    scrollPage()
    focus('#side')
    expect(id(findTarget('left'))).not.toMatch(/^r[4-6]$/)
  })
})

describe('sideways rows', () => {
  // A link above, then two rows of cards in tracks whose view (between 20px scroll paddings) shows
  // three cards. Row A is at its start: a4, a5 and its See all tile lie right of its view, a4 just
  // peeking into the padding. Row B is paged on by two cards: b1 and b2 lie left of its view.
  function rowsPage() {
    const cards = (row: string) =>
      [1, 2, 3, 4, 5]
        .map(
          (n) =>
            `<li><article id="${row}${n}"><a id="${row}${n}-link" href="/w/${row}${n}" data-card-link>${row}${n}</a></article></li>`,
        )
        .join('')
    const track =
      'data-spatial="track" style="scroll-padding-left: 20px; scroll-padding-right: 20px"'
    document.body.innerHTML = `
      <main>
        <a id="top" href="/t">Top</a>
        <section><div id="ta" ${track}><ul>${cards('a')}<li><a id="a-all" href="/c/a">See all</a></li></ul></div></section>
        <section><div id="tb" ${track}><ul>${cards('b')}</ul></div></section>
      </main>`
    place('#top', [0, 1640, 200, 40])
    place('#ta', [80, 0, 1000, 240])
    place('#tb', [400, 0, 1000, 240])
    for (let n = 1; n <= 5; n++) {
      place(`#a${n}`, [100, 20 + (n - 1) * 320, 300, 200])
      place(`#a${n}-link`, [250, 20 + (n - 1) * 320, 200, 20])
      place(`#b${n}`, [420, 20 + (n - 3) * 320, 300, 200])
      place(`#b${n}-link`, [570, 20 + (n - 3) * 320, 200, 20])
    }
    place('#a-all', [100, 20 + 5 * 320, 300, 170])
  }

  it('walks its cards with ← / →, those out of view included, to the See all tile', () => {
    rowsPage()
    focus('#a3-link')
    expect(id(findTarget('right'))).toBe('a4-link')
    focus('#a5-link')
    expect(id(findTarget('right'))).toBe('a-all')
    expect(id(findTarget('left'))).toBe('a4-link')
  })

  it('offers moves from outside it only the cards in its view', () => {
    rowsPage()
    // Straight down from the top-right link: a3, the last card in view, not the tile below the link.
    focus('#top')
    expect(id(findTarget('down'))).toBe('a3-link')
    // Nothing in view lies left of a1 or right of a3: no jump to b2 or b5, out of B's view.
    focus('#a1-link')
    expect(findTarget('left')).toBeNull()
    focus('#a3-link')
    expect(id(findTarget('down'))).toBe('b5-link')
    focus('#b5-link')
    expect(id(findTarget('up'))).toBe('a3-link')
  })

  it('takes PageDown / PageUp to the first card in view of a paged row', () => {
    rowsPage()
    focus('#a1-link')
    expect(id(findSection(1))).toBe('b3-link')
    focus('#b4-link')
    expect(id(findSection(-1))).toBe('a1-link')
  })

  // Row A's items (its cards' slots) and scroll range; spies for the reveal.
  function trackA() {
    const track = document.getElementById('ta')!
    document.querySelectorAll<HTMLElement>('#ta li').forEach((li, i) => {
      li.getBoundingClientRect = () =>
        ({
          top: 100,
          left: 20 + i * 320,
          width: 300,
          height: 200,
          right: 320 + i * 320,
          bottom: 300,
        }) as DOMRect
    })
    Object.defineProperties(track, {
      scrollWidth: { configurable: true, value: 1960 },
      clientWidth: { configurable: true, value: 1000 },
    })
    const scrollIntoView = vi.fn()
    const scrollTo = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    track.scrollTo = scrollTo as typeof track.scrollTo
    return { track, scrollIntoView, scrollTo }
  }

  it('reveals a whole card as the track follows focus, not just its title link', () => {
    rowsPage()
    const { track, scrollIntoView, scrollTo } = trackA()
    try {
      // In view already: the card itself comes into view up or down.
      focus('#a2-link')
      expect(moveFocus('right')).toBe(true)
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(document.getElementById('a3'))
      expect(scrollIntoView).toHaveBeenLastCalledWith(
        expect.objectContaining({ block: 'center', inline: 'nearest' }),
      )
      expect(scrollTo).not.toHaveBeenCalled()
      // Cut on the right: the row moves on to the next card position, and comes into view whole.
      expect(moveFocus('right')).toBe(true)
      expect(document.activeElement?.id).toBe('a4-link')
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 320 }))
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(track)
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    }
  })

  it('shows a card cut by less than half whole, where "nearest" would snap back', () => {
    rowsPage()
    // A narrower view (Recently viewed's smaller cards): a3 shows all but its last 80px.
    place('#ta', [80, 0, 900, 240])
    const { scrollTo } = trackA()
    try {
      focus('#a2-link')
      expect(moveFocus('right')).toBe(true)
      expect(document.activeElement?.id).toBe('a3-link')
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 320 }))
    } finally {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
    }
  })
})

describe('cards and the hero', () => {
  it("reaches a card's Save from a title whose link runs on past its line clamp", () => {
    document.body.innerHTML = `
      <main><article id="c">
        <h3 id="c-title" style="overflow: hidden"><a id="c-link" href="/w/1" data-card-link>A long title</a></h3>
        <button id="c-save">Save</button>
      </article></main>`
    place('#c', [100, 0, 300, 220])
    place('#c-title', [230, 0, 300, 44])
    // Four lines laid out, two shown: the link's box reaches past the Save button's top.
    place('#c-link', [230, 0, 300, 88])
    place('#c-save', [290, 0, 60, 30])
    // Nothing lies below the card: ↓ from its link reaches its own Save.
    focus('#c-link')
    expect(id(findTarget('down'))).toBe('c-save')
    focus('#c-save')
    expect(id(findTarget('up'))).toBe('c-link')
  })

  it("takes ↓ from the hero's previous / next to its Play, over nearer content below", () => {
    document.body.innerHTML = `
      <main>
        <section><button id="next" data-spatial="over-entry">Next</button>
          <a id="play" href="/w/1" data-spatial="entry">Play</a></section>
        <section><a id="chip" href="/c/1">Chip</a></section>
      </main>`
    place('#next', [0, 800, 44, 44])
    place('#play', [600, 0, 100, 44])
    place('#chip', [700, 780, 100, 40])
    focus('#next')
    expect(id(findTarget('down'))).toBe('play')
    focus('#play')
    expect(id(findTarget('down'))).toBe('chip')
  })
})

describe('sticky blocks in the page (the watch page below lg)', () => {
  // Scrolled down: the header, then Back's row and the stage stuck under it, the page beneath.
  function watch(sticky = true) {
    const pos = sticky ? 'sticky' : 'static'
    document.body.innerHTML = `
      <header style="position: sticky"><a id="home" href="/">Home</a><a id="theme" href="/t">Theme</a></header>
      <main>
        <div id="row" style="position: ${pos}"><button id="back">Back</button></div>
        <div id="wrap" style="position: ${pos}"><div id="stage" tabindex="-1"><button id="key">Pause</button></div></div>
        <article><button id="save">Save</button><a id="meta" href="/m">Meta</a><a id="crumb" href="/c">Browse</a></article>
      </main>`
    place('header', [0, 0, 1024, 56])
    place('#home', [10, 10, 60, 30])
    place('#theme', [10, 900, 40, 40])
    place('#row', [56, 0, 1024, 56])
    place('#back', [64, 16, 80, 40])
    place('#wrap', [112, 0, 1024, 330])
    place('#stage', [112, 0, 1024, 330])
    // Its centre below the middle of the screen (768px).
    place('#key', [400, 16, 80, 40])
    // Scrolled under the stage, and on past it under the header.
    place('#save', [200, 16, 80, 40])
    place('#meta', [20, 600, 80, 30])
    place('#crumb', [460, 16, 80, 40])
    // What shows at a point: the topmost of these whose box holds it.
    const layers = ['#home', '#theme', 'header', '#back', '#row', '#key', '#stage', '#wrap']
    document.elementFromPoint = (x: number, y: number) =>
      [...layers, '#crumb', '#save', '#meta']
        .map((s) => document.querySelector(s)!)
        .find((el) => {
          const r = el.getBoundingClientRect()
          return x >= r.left && x < r.right && y >= r.top && y < r.bottom
        }) ?? null
  }
  afterEach(() => {
    delete (document as { elementFromPoint?: unknown }).elementFromPoint
  })

  it('are page content: ↑ from below reaches the stage, ↑ from the stage Back', () => {
    watch()
    focus('#crumb')
    expect(id(findTarget('up'))).toBe('key')
    focus('#key')
    expect(id(findTarget('up'))).toBe('back')
    // ← / → from Back stay off the header (nothing beside it in the page: no move).
    focus('#back')
    expect(findTarget('right')).toBeNull()
  })

  it('cover what scrolled under them, and under the header past them', () => {
    watch()
    focus('#back')
    expect(id(findTarget('down'))).toBe('key')
    place('#key', [400, 600, 80, 40])
    focus('#key')
    expect(id(findTarget('up'))).toBe('back')
  })

  it('leave the page as it was where nothing sticks (lg)', () => {
    watch(false)
    focus('#back')
    expect(id(findTarget('down'))).toBe('save')
  })
})

describe('keepsArrow', () => {
  it('lets fields keep left/right until the caret hits an edge; widgets keep every arrow', () => {
    document.body.innerHTML =
      '<input id="t" /><textarea id="ta"></textarea><select id="s"></select>'
    const t = document.getElementById('t') as HTMLInputElement
    t.value = 'abc'
    t.setSelectionRange(1, 1)
    expect(keepsArrow(t, 'left')).toBe(true)
    expect(keepsArrow(t, 'right')).toBe(true)
    expect(keepsArrow(t, 'down')).toBe(false)
    t.setSelectionRange(3, 3)
    expect(keepsArrow(t, 'right')).toBe(false)
    expect(keepsArrow(t, 'left')).toBe(true)
    t.setSelectionRange(0, 3)
    expect(keepsArrow(t, 'left')).toBe(true)
    expect(keepsArrow(document.getElementById('ta'), 'right')).toBe(false)
    expect(keepsArrow(document.getElementById('s'), 'up')).toBe(true)
    expect(keepsArrow(null, 'up')).toBe(false)
  })

  it('lets a search field with its suggestion list open keep up/down, and only then', () => {
    document.body.innerHTML = '<input id="c" type="search" role="combobox" aria-expanded="true" />'
    const c = document.getElementById('c') as HTMLInputElement
    c.value = 'gen'
    c.setSelectionRange(3, 3)
    expect(keepsArrow(c, 'down')).toBe(true)
    expect(keepsArrow(c, 'up')).toBe(true)
    expect(keepsArrow(c, 'left')).toBe(true)
    expect(keepsArrow(c, 'right')).toBe(false)
    c.setAttribute('aria-expanded', 'false')
    expect(keepsArrow(c, 'down')).toBe(false)
    expect(keepsArrow(c, 'up')).toBe(false)
    expect(keepsArrow(c, 'left')).toBe(true)
  })
})

describe('findSection', () => {
  it('jumps to the first card of the next or previous section, stopping at the ends', () => {
    page()
    // Wrap the grid in a section (moving the nodes keeps their placed rects) and add one above.
    const grid = document.querySelector('ul')!
    const s2 = document.createElement('section')
    grid.replaceWith(s2)
    s2.append(grid)
    s2.insertAdjacentHTML(
      'beforebegin',
      '<section id="s1"><a id="s1-a" href="/x">Chip</a></section>',
    )
    place('#s1-a', [70, 10, 60, 20])
    focus('#s1-a')
    expect(id(findSection(1))).toBe('a1-link')
    focus('#b2-link')
    expect(id(findSection(-1))).toBe('s1-a')
    expect(findSection(1)).toBeNull()
    ;(document.activeElement as HTMLElement).blur()
    expect(id(findSection(1))).toBe('s1-a')
  })
})

describe('moveFocus', () => {
  it('focuses the target and reports whether it moved', () => {
    page()
    focus('#a1-link')
    expect(moveFocus('right')).toBe(true)
    expect(document.activeElement?.id).toBe('a2-link')
    expect(moveFocus('left')).toBe(true)
    expect(document.activeElement?.id).toBe('a1-link')
    expect(moveFocus('left')).toBe(false)
    expect(document.activeElement?.id).toBe('a1-link')
  })
})

describe('useSpatialNavigation', () => {
  it("keeps the browser's arrow scroll from cutting a smooth reveal short", () => {
    page()
    // jsdom has no scrollIntoView.
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const { unmount } = renderHook(() => useSpatialNavigation())
    const pressDown = () => {
      const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      document.activeElement?.dispatchEvent(e)
      return e.defaultPrevented
    }
    try {
      focus('#b1-link')
      expect(pressDown()).toBe(true)
      expect(document.activeElement?.id).toBe('foot')
      expect(scrollIntoView).toHaveBeenLastCalledWith(
        expect.objectContaining({ behavior: 'smooth' }),
      )
      // Nothing lies below the footer link, but its reveal is still running.
      expect(pressDown()).toBe(true)
      now += 1000
      expect(pressDown()).toBe(false)
    } finally {
      unmount()
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
      vi.restoreAllMocks()
    }
  })
})

describe('focusAndReveal', () => {
  it('brings a block to the top whole for a card in its row (data-reveal-whole), not the row centred', () => {
    document.body.innerHTML = `
      <div id="zone" data-reveal-whole>
        <section id="hero"><a href="/play">Play</a></section>
        <div data-spatial="track" id="track">
          <ul><li><article><a id="card" data-card-link href="/watch/a">A</a></article></li></ul>
        </div>
      </div>`
    const zone = document.getElementById('zone')!
    const track = document.getElementById('track')!
    zone.scrollIntoView = vi.fn()
    track.scrollIntoView = vi.fn()
    document.querySelector('article')!.scrollIntoView = vi.fn()
    expect(focusAndReveal(document.getElementById('card')!, true)).toBe(true)
    expect(zone.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }))
    expect(track.scrollIntoView).not.toHaveBeenCalled()
  })

  it('centres the card instead when the block at the top would leave it below the fold (a phone)', () => {
    document.body.innerHTML = `
      <div id="zone" data-reveal-whole>
        <section id="hero"><a href="/play">Play</a></section>
        <div data-spatial="track" id="track">
          <ul><li><article><a id="card" data-card-link href="/watch/a">A</a></article></li></ul>
        </div>
      </div>`
    const zone = document.getElementById('zone')!
    const article = document.querySelector('article')!
    article.getBoundingClientRect = () =>
      ({ top: innerHeight - 99, bottom: innerHeight + 1, left: 0, right: 0 }) as DOMRect
    zone.scrollIntoView = vi.fn()
    article.scrollIntoView = vi.fn()
    expect(focusAndReveal(document.getElementById('card')!, true)).toBe(true)
    expect(zone.scrollIntoView).not.toHaveBeenCalled()
    expect(article.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center' }),
    )
  })
})
