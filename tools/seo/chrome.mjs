// The app's header and phone tab bar as static markup, painted by each page shell as soon as the
// stylesheet lands (seconds before the scripts mount the app, which then replaces it with the same
// pixels). Copied from Header.tsx at the app's first render; chrome.test.mjs renders the real
// components and fails when the two drift. Where the app picks markup in script (the Help label
// from 64rem, the theme icon), both versions are here and CSS shows the one the app will render:
// `data-shell` marks them (wide / narrow, light / dark) for that test. public/theme-boot.js puts the
// theme on <html> first, so the dark variants apply before the first paint.
import { buttonClass, iconButtonClass } from '../../src/components/ui/button-styles.ts'

// Header.tsx NAV_LINK, TAB and TAB_ICON.
const NAV_LINK =
  'relative inline-flex h-10 items-center pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-0.5 rounded-pill px-2 text-sm font-medium whitespace-nowrap text-ink-2 transition-[background-color,color,box-shadow] hover:bg-frost-2 hover:text-ink hover:shadow-(--shadow-glass) focus-visible:shadow-glow aria-[current=page]:font-semibold aria-[current=page]:text-ink after:absolute after:inset-x-2 after:-bottom-1.5 after:h-[3px] after:rounded-full after:bg-maroon after:opacity-0 after:shadow-[0_0_10px_1px_var(--color-glow-brand)] after:transition-opacity aria-[current=page]:after:opacity-100 dark:after:bg-band-gold lg:px-3 lg:after:inset-x-3'
const TAB =
  'group/tab relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-ink focus-visible:-outline-offset-4 aria-[current=page]:font-semibold aria-[current=page]:text-maroon after:absolute after:inset-x-6 after:top-0 after:h-[3px] after:rounded-b-full after:bg-maroon after:opacity-0 after:shadow-[0_0_12px_2px_var(--color-glow-brand)] after:transition-opacity aria-[current=page]:after:opacity-100 dark:aria-[current=page]:text-band-gold dark:after:bg-band-gold'
const TAB_ICON =
  'relative isolate grid place-items-center before:absolute before:-inset-1 before:-z-10 before:rounded-full before:bg-surface-2 before:opacity-0 before:shadow-(--shadow-glass) before:transition-opacity group-aria-[current=page]/tab:before:opacity-100 dark:before:bg-frost-2'

// icons.tsx
const svg = (body, attrs = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${attrs}>${body}</svg>`
const SEARCH = '<circle cx="11" cy="11" r="6.5"></circle><path d="m20 20-4.2-4.2"></path>'
const SUN =
  '<circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M4.3 4.3l1.4 1.4M18.3 18.3l1.4 1.4M2.5 12h2M19.5 12h2M4.3 19.7l1.4-1.4M18.3 5.7l1.4-1.4"></path>'
const MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"></path>'
const HELP =
  '<circle cx="12" cy="12" r="9"></circle><path d="M9.4 9.3a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8v.4M12 17.3v.1"></path>'
const HOME = '<path d="M3.5 11 12 4l8.5 7M5.5 9.5V20h4.5v-5h4v5h4.5V9.5"></path>'
const GRID =
  '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"></rect><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"></rect><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"></rect><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"></rect>'
const BOOKMARK = '<path d="M6.5 4.5h11v16l-5.5-3.6-5.5 3.6z"></path>'

const HELD = 'aria-expanded:bg-frost-2 aria-expanded:text-ink aria-expanded:shadow-(--shadow-glass)'
const HELP_ATTRS =
  'type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Help and theme" title="Help and theme" data-spatial="aside"'

/**
 * Header and tab bar for a page under `section` ('home', 'collections', 'my-list' or none, as the
 * app's NavLinks match it), with links under `base` (the router's basename).
 */
export function chromeMarkup(base, section) {
  const root = base.replace(/(.)\/$/, '$1')
  const href = (path) => (path === '/' ? root : `${root === '/' ? '' : root}${path}`)
  const link = (path, cls, name, body) => {
    const on = name === section
    return `<a${on ? ' aria-current="page"' : ''} class="${cls}${on ? ' active' : ''}" href="${href(path)}" data-discover="true">${body}</a>`
  }
  const tab = (path, name, icon, label) =>
    `<li class="flex flex-1">${link(path, TAB, name, `<span class="${TAB_ICON}">${svg(icon, ' class="size-6"')}</span>${label}`)}</li>`
  return [
    '<header class="shell-edge sticky top-0 z-40 border-b bg-glass backdrop-blur-lg backdrop-saturate-150 transition-[border-color,box-shadow] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:brand-stripe border-line">',
    '<div class="flex min-h-(--header-h) flex-wrap items-center gap-x-2 px-(--gutter) md:flex-nowrap lg:gap-x-3">',
    '<div class="flex min-w-0 shrink-0 flex-col"><div class="flex items-center gap-2">',
    `<a aria-label="UPOU OER, home" class="flex min-h-10 items-center gap-1 rounded-sm font-display text-[1.375rem] leading-none tracking-tight sm:text-2xl" href="${href('/')}" data-discover="true"><span class="text-ink">UPOU</span><span class="text-maroon">OER</span></a>`,
    '<span role="note" title="Proof of concept" aria-label="Proof of concept" class="rounded-pill border border-glass-border bg-frost px-1 py-1 text-xs shadow-[inset_0_1px_0_var(--color-rim)] leading-none font-semibold tracking-wide text-ink-2 uppercase sm:px-1.5 sm:tracking-wider">Proof of concept</span>',
    '</div><p class="-mt-1.5 hidden text-xs leading-none tracking-wide text-ink-3 md:block">Open Educational Resources</p></div>',
    '<nav aria-label="Main" class="ml-3 hidden items-center gap-0.5 md:flex lg:ml-6">',
    link('/', NAV_LINK, 'home', 'Browse'),
    link('/collections', NAV_LINK, 'collections', 'Collections'),
    link('/my-list', NAV_LINK, 'my-list', 'My List'),
    '</nav>',
    '<form role="search" class="hidden md:flex order-last min-w-0 basis-full pb-2.5 md:order-none md:ml-auto md:w-40 md:basis-auto md:max-lg:land:w-48 md:pb-0 lg:w-56 xl:w-80">',
    '<label for="shell-search" class="sr-only">Search videos</label><div class="group/search relative w-full">',
    svg(
      SEARCH,
      ' class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3 transition-colors group-focus-within/search:text-ink-2"',
    ),
    '<input id="shell-search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="shell-suggest" placeholder="Search videos" autocomplete="off" spellcheck="false" enterkeyhint="search" class="h-10 w-full md:pointer-coarse:h-11 land:pointer-coarse:h-11 rounded-pill border border-glass-border bg-surface/90 pr-10 pl-10 text-sm text-ink shadow-(--shadow-elev-1) transition-[background-color,border-color,box-shadow] placeholder:text-ink-3 hover:border-rim hover:bg-surface hover:shadow-(--shadow-glass) focus:border-focus focus:bg-surface focus:shadow-(--shadow-glass) focus-visible:shadow-[var(--shadow-glass),var(--shadow-glow)] [&amp;::-webkit-search-cancel-button]:appearance-none" type="search" value="">',
    '<ul id="shell-suggest" role="listbox" aria-label="Suggestions" hidden="" class="absolute top-full z-50 mt-1.5 max-h-[min(23rem,calc(100dvh-var(--header-h)-4.5rem))] overflow-y-auto overscroll-contain shell-scroll tv-suggest rounded-card border border-glass-border bg-surface p-1.5 text-sm shadow-(--shadow-elev-3) inset-x-0 md:left-auto md:w-[max(100%,26rem)]"></ul>',
    '</div></form>',
    `<button type="button" aria-label="Switch theme" title="Switch theme" class="${iconButtonClass('ghost', 'sm', 'ml-auto md:hidden lg:ml-0 lg:inline-flex')}" data-spatial="aside">`,
    svg(SUN, ' data-shell="light" class="dark:hidden"'),
    svg(MOON, ' data-shell="dark" class="hidden dark:block"'),
    '</button>',
    '<div class="relative ">',
    `<span data-shell="narrow" class="contents lg:hidden"><button ${HELP_ATTRS} class="${iconButtonClass('ghost', 'sm', HELD)}">${svg(HELP)}</button></span>`,
    `<span data-shell="wide" class="hidden lg:contents"><button ${HELP_ATTRS} class="${buttonClass('ghost', 'sm', HELD)}">${svg(HELP)}Help</button></span>`,
    '</div></div></header>',
    '<nav aria-label="Primary" class="fixed inset-x-0 bottom-0 z-40 border-t border-glass-border bg-surface/92 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-[0_-8px_24px_-18px_rgb(27_26_23/0.18)] dark:shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.6)] backdrop-blur-lg backdrop-saturate-150 md:hidden">',
    '<ul class="flex h-(--tabbar-h)">',
    tab('/', 'home', HOME, 'Browse'),
    tab('/collections', 'collections', GRID, 'Collections'),
    tab('/search', 'search', SEARCH, 'Search'),
    tab('/my-list', 'my-list', BOOKMARK, 'My List'),
    '</ul></nav>',
  ].join('')
}
