import { describe, expect, it } from 'vitest'
import { detailsShortfall } from './details'

// A dialog view of the given height holding the details: a title and a facts line under it.
function layout(viewHeight: number, titleTop: number) {
  const box = (el: Element, top: number, height: number) => {
    el.getBoundingClientRect = () => ({ top, bottom: top + height, height }) as DOMRect
    return el
  }
  const view = box(document.createElement('dialog'), 0, viewHeight)
  const details = document.createElement('div')
  details.append(box(document.createElement('h2'), titleTop, 40))
  details.append(box(document.createElement('p'), titleTop + 52, 24))
  return [view, details] as const
}

describe('quick look opened on the details (#details)', () => {
  it('stays at the top of the panel while the title and facts line are in view', () => {
    expect(detailsShortfall(...layout(768, 73))).toBe(0) // desktop: beside the picture
    expect(detailsShortfall(...layout(844, 627))).toBe(0) // phone: under the picture
  })

  it('scrolls just far enough to show the title and facts line when they are off screen', () => {
    // facts line ends at 900 + 76 = 976; with 16px of air, 976 + 16 - 640
    expect(detailsShortfall(...layout(640, 900))).toBe(352)
  })

  it('never scrolls the title past the top', () => {
    const [view, details] = layout(60, 200) // a view shorter than title and facts
    expect(detailsShortfall(view, details)).toBe(184) // title top lands 16px from the top
    expect(detailsShortfall(view, document.createElement('div'))).toBe(0)
  })
})
