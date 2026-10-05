import { describe, expect, it } from 'vitest'

// jsdom applies no stylesheets, so these read watch.css itself. Tests run from the repo root.
type Fs = { readFileSync(path: string, encoding: 'utf8'): string }
const node = (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): Fs } }).process
const css = node.getBuiltinModule('node:fs').readFileSync('src/features/watch/watch.css', 'utf8')

// The block that makes the Back row and the stage sticky: from its @media to the next top-level rule.
const start = css.indexOf('@media (width < 64rem) {\n  html:has(.watch-page) {\n    /* The stage')
const sticky = css.slice(start, css.indexOf('@keyframes watch-stage-stick'))

describe('the sticky stage under lg', () => {
  it('sticks on every screen below lg, whatever its orientation or height', () => {
    expect(start).toBeGreaterThan(-1)
    expect(sticky).toMatch(/\.watch-back-row,\s*\.watch-stage-wrap \{\s*position: sticky;/)
    // The old gate (upright, 600px tall) must not come back around the sticky rules.
    expect(css).not.toMatch(/orientation: portrait\) and \(height >= 37\.5rem\)/)
  })

  it('caps the stuck stage by paint, not box: scale and a higher sticky place', () => {
    expect(sticky).toContain('--stuck-h: min(')
    expect(sticky).toContain('46svh')
    expect(css).toContain('scale: tan(atan2(var(--stuck-h), var(--rest-h)))')
    expect(sticky).toMatch(/top: calc\(var\(--header-h\) \+ var\(--stack\) - var\(--tuck, 0px\)\)/)
  })

  it('keeps focused rows clear of the stack as it is stuck', () => {
    expect(sticky).toMatch(
      /scroll-padding-top: calc\(var\(--header-h\) \+ var\(--stack\) \+ var\(--stuck-h\) \+ var\(--focus-air\)\)/,
    )
  })

  it('spares a row of Up next its air where the room under the stuck stage is about one row', () => {
    // 1rem at most, else half of what the room (the screen less the header, stack, stuck stage, tab
    // bar and home indicator) has beyond a 6.5rem row: at 740x360 a focused row ended 8px under the bar.
    expect(sticky).toMatch(/--focus-air: clamp\(\s*0px,[^;]*- 6\.5rem[^;]*\/\s*2,\s*1rem\s*\);/)
    expect(sticky).toMatch(
      /--focus-air: clamp\([^;]*var\(--tabbar-h\) -\s*env\(safe-area-inset-bottom/,
    )
  })

  it('leaves lg and up alone: nothing sticky outside the below-lg media query', () => {
    const outside = css.slice(0, start) + css.slice(start + sticky.length)
    expect(outside).not.toMatch(/position: sticky/)
  })
})

describe('phone fixes read from watch.css', () => {
  it('counts the home-indicator inset in the tab bar clearance for focus and More…', () => {
    expect(css).toMatch(
      /html:has\(\.watch-page\) \{\s*scroll-padding-bottom: calc\(\s*var\(--tabbar-h\) \+ env\(safe-area-inset-bottom, 0px\) \+ var\(--focus-air, 1rem\)\s*\);/,
    )
  })

  it('shows a scrolled page at once (no blank page under the preview) and gives no reveal', () => {
    expect(css).toContain('.watch-page:has(.watch-stage .reel):not([data-scrolled]) .watch-aside')
    expect(css).not.toMatch(/\.watch-page:not\(:has\(\.watch-stage \.reel\)\)/)
  })

  it('rests the stage wholly above the tab bar on a phone on its side', () => {
    expect(css).toMatch(
      /@media \(width < 48rem\) \{\s*html:has\(\.watch-page\) \{\s*--stage-cap: calc\(\s*\(100dvh - 8rem - var\(--tabbar-h\) - env\(safe-area-inset-bottom, 0px\)\) \* 16 \/ 9\s*\);/,
    )
  })

  it('draws the stage buttons out by the stage scale, which animates with the stage', () => {
    expect(css).toMatch(/@property --stage-s \{\s*syntax: '<number>';/)
    expect(css).toContain('animation: watch-stage-scale linear both;')
    expect(css).toContain('inset: min(0px, calc((100% - 44px / var(--stage-s, 1)) / 2));')
  })

  it("grows the preview's buttons upward, clear of the stage's clipped foot", () => {
    expect(css).toMatch(
      /\.watch-stage \.reel-btn::after \{\s*inset: min\(0px, calc\(100% - 44px \/ var\(--stage-s, 1\)\)\)\s+min\(0px, calc\(\(100% - 44px \/ var\(--stage-s, 1\)\) \/ 2\)\) 0;/,
    )
  })

  it('lifts the page above the footer, so the floating Back is never under its links', () => {
    expect(css).toMatch(/\.watch-page \{[^}]*isolation: isolate;[^}]*z-index: 1;/)
  })

  it('draws every touch target out to 44px with an ::after, never padding', () => {
    const block = css.slice(css.indexOf('Touch: a standalone control'))
    expect(block).toContain('@media (pointer: coarse)')
    expect(block).toContain('inset: min(0px, calc((100% - 44px) / 2))')
    for (const name of ['.watch-back', '.watch-refresh', '.watch-upnext-more', '.watch-cite-copy'])
      expect(block).toContain(name)
  })
})
