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
      /scroll-padding-top: calc\(var\(--header-h\) \+ var\(--stack\) \+ var\(--stuck-h\) \+ 1rem\)/,
    )
  })

  it('leaves lg and up alone: nothing sticky outside the below-lg media query', () => {
    const outside = css.slice(0, start) + css.slice(start + sticky.length)
    expect(outside).not.toMatch(/position: sticky/)
  })
})
