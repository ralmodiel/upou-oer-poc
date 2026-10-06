// Low-memory ("lite") profile for TVs and other small devices, decided once at startup and put on
// <html data-lite> so CSS can drop the decorative, memory-heavy effects (see the [data-lite]
// block in index.css). Layout and remote/keyboard navigation are never touched.
//
// Lite when: a TV user agent (LG webOS, Samsung Tizen, HbbTV and friends), navigator.deviceMemory
// <= 2, a Chromium older than 100 (the engines of old TVs), or ?lite=1 in the URL (?lite=0 turns
// it off; handy to try the profile on a desktop). Dropped in lite: the blurred page backdrop, the
// watch page's ambient light, every backdrop blur (the glass tokens turn near-opaque instead),
// and motion (animations and transitions jump to their end state).

const TV_UA =
  /Web0S|webOS|NetCast|Tizen|SMART-TV|SmartTV|HbbTV|VIDAA|BRAVIA|Hisense|CrKey|AFT[A-Z]/i

function detectLite(): boolean {
  const forced = new URLSearchParams(location.search).get('lite')
  if (forced === '1' || forced === '0') return forced === '1'
  const chrome = /Chrome\/(\d+)/.exec(navigator.userAgent)
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  return (
    TV_UA.test(navigator.userAgent) ||
    (memory !== undefined && memory <= 2) ||
    (chrome !== null && Number(chrome[1]) < 100)
  )
}

export const lite = detectLite()
if (lite) document.documentElement.setAttribute('data-lite', '')

// View Transitions snapshot the page into GPU layers: off in lite (the callers check for them).
if (lite) {
  delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
  delete (Element.prototype as { startViewTransition?: unknown }).startViewTransition
}

// Engines before Chromium 99 drop every `@layer` block, which is all of Tailwind (theme, base
// utilities): the page would show unstyled. The build emits the same rules unlayered as
// legacy-layers.css; it goes in first so the app's own unlayered CSS still wins, as it does with
// layers. (A short unstyled flash on those engines is accepted.)
if (typeof CSSLayerBlockRule === 'undefined') {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${import.meta.env.BASE_URL}legacy-layers.css`
  document.head.prepend(link)
}

// Chromium before 93 (webOS 22 and older) lacks these two; the app uses both.
Object.hasOwn ??= (o, k) => Object.prototype.hasOwnProperty.call(o, k)
for (const proto of [Array.prototype, String.prototype] as { at?: unknown }[]) {
  proto.at ??= function (this: ArrayLike<unknown>, i: number) {
    const n = Math.trunc(i) || 0
    return this[n < 0 ? this.length + n : n]
  }
}
