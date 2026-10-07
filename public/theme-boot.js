// The stored theme (or the system's) on <html data-theme> before a page shell's first paint, as
// bootstrapTheme in src/lib/theme.ts does once the app runs; the CSP allows no inline script.
// Also starts the home shell's hero-still preload (off in the HTML) once the stylesheet is in, so
// the picture never competes with the first paint.
// And, on the home shell, a quick look link (?v=id) starts the download of the catalog file that
// holds that video (data-catalog lists the files; chunkOf in src/data/split.ts picks one) at once:
// the app's scripts would only ask for it after they have run, a second or two later on a slow link.
/* global document, matchMedia, location, CSSLayerBlockRule */
;(function () {
  var theme
  try {
    theme = JSON.parse(localStorage.getItem('upou:theme'))
  } catch {
    // No storage (privacy mode): follow the system.
  }
  if (theme !== 'light' && theme !== 'dark')
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#141112' : '#faf8f6')
  })
  // Engines before Chromium 99 drop every @layer block (all of Tailwind): the shell's header would
  // show unstyled, its icons huge, until the app's scripts load legacy-layers.css (src/lib/lite.ts,
  // which skips a link that is here). First in <head>, as lite.ts does, so the app's CSS still wins.
  if (typeof CSSLayerBlockRule === 'undefined') {
    var legacy = document.createElement('link')
    legacy.rel = 'stylesheet'
    legacy.href = document.currentScript.src.replace(/theme-boot.js.*$/, 'legacy-layers.css')
    legacy.setAttribute('data-legacy-layers', '')
    document.head.insertBefore(legacy, document.head.firstChild)
  }
  try {
    var files = (document.currentScript.getAttribute('data-catalog') || '').split(' ')
    var id = new URLSearchParams(location.search).get('v')
    if (id && files.length > 2) {
      var h = 2166136261
      for (var i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
      // Low priority: it still lands before the scripts have run, and the first paint is not held up.
      // Fetch mode and credentials as the app's fetch, so it reuses the download. (A video in the
      // pool, file 0, is asked for once the app runs: only the newest of each collection are there.)
      var link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'fetch'
      link.crossOrigin = 'anonymous'
      link.setAttribute('fetchpriority', 'low')
      link.href = files[1 + ((h >>> 0) % (files.length - 1))]
      document.head.appendChild(link)
    }
  } catch {
    // No such API: the app asks for the file itself.
  }
  // Load events do not bubble: caught on the way down.
  document.addEventListener(
    'load',
    function (e) {
      if (e.target.rel !== 'stylesheet' || e.target.hasAttribute('data-legacy-layers')) return
      var hero = document.querySelector('link[data-hero]')
      if (hero) hero.media = 'all'
    },
    true,
  )
})()
