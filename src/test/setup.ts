import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { resetStorageCache } from '../lib/storage'
import { resetTrail } from '../lib/trail'

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetStorageCache()
  resetTrail()
})

// jsdom gaps
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver
Element.prototype.scrollTo ??= function () {}
Element.prototype.scrollBy ??= function () {}
window.scrollTo = () => {}

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
