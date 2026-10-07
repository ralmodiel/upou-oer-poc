// The stored theme (or the system's) on <html data-theme> before a page shell's first paint, as
// bootstrapTheme in src/lib/theme.ts does once the app runs; the CSP allows no inline script.
// Also starts the home shell's hero-still preload (off in the HTML) once the stylesheet is in, so
// the picture never competes with the first paint.
/* global document, matchMedia */
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
  // Load events do not bubble: caught on the way down.
  document.addEventListener(
    'load',
    function (e) {
      if (e.target.rel !== 'stylesheet') return
      var hero = document.querySelector('link[data-hero]')
      if (hero) hero.media = 'all'
    },
    true,
  )
})()
