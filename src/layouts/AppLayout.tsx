import { useEffect, useRef, useState, type MouseEvent } from 'react'
import {
  Outlet,
  useLocation,
  useNavigation,
  useNavigationType,
  useRevalidator,
  useRouteError,
} from 'react-router'
import DetailModal from '../components/DetailModal'
import Footer from '../components/Footer'
import Header, { TabBar } from '../components/Header'
import PrivacyDialog from '../components/PrivacyDialog'
import ShortcutsSheet from '../components/ShortcutsSheet'
import { usePainted } from '../components/browse-hooks'
import { useReturnFocus } from '../components/hooks'
import { useWarmRecommender } from '../components/recs'
import { installFocusMarks } from '../lib/focusMarks'
import { useGlobalShortcuts } from '../lib/shortcuts'
import { useSpatialNavigation } from '../lib/spatial'
import '../components/browse.css'

// Move focus (not just scroll) so the next Tab starts inside the main content.
function skipToMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  document.getElementById('main')?.focus()
}

// A page that waits for the rest of the catalog (first visit, see catalog.ts) leaves the old one on
// screen: a thin bar under the header's stripe, after a short delay so quick changes show none.
function NavProgress() {
  const busy = useNavigation().state !== 'idle'
  return busy ? <div aria-hidden className="nav-progress" /> : null
}

// A new page is announced by its title. When the link that opened it was in the header or tab bar
// (or focus was lost), focus moves to the page so the next Tab starts there; pages that place focus
// themselves (watch, a submitted search) and Back (useReturnFocus) keep theirs.
const ANNOUNCE_MS = 150
function RouteAnnouncer() {
  const { pathname } = useLocation()
  const type = useNavigationType()
  const [message, setMessage] = useState('')
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const timer = window.setTimeout(() => {
      setMessage(document.title)
      const el = document.activeElement
      if (type === 'POP' || el?.matches('input, textarea, select, [role="combobox"]')) return
      if (!el || el === document.body || el.closest('header, nav[aria-label="Primary"]'))
        document.getElementById('main')?.focus({ preventScroll: true })
    }, ANNOUNCE_MS)
    return () => clearTimeout(timer)
    // The path alone: a query (search as you type) or ?v= (quick look) is no new page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  )
}

const FRAME =
  'flex min-h-dvh flex-col pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:pb-0'

/**
 * What stands in while the first page waits for the rest of the catalog (a direct link to a page
 * other than the home): the same header and tab bar as the page shell's, in place, rather than a
 * blank frame.
 */
export function AppFallback() {
  return (
    <div className={FRAME}>
      <NavLoading />
      <Header />
      <TabBar />
      <main className="flex-1" />
    </div>
  )
}

// A first load that waits on the catalog shows the in-app navigation's thin bar (after its delay).
function NavLoading() {
  return (
    <>
      <div aria-hidden className="nav-progress" />
      <p role="status" className="sr-only">
        Loading videos
      </p>
    </>
  )
}

const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically/i
const RELOADED_KEY = 'upou:chunk-reload'

// A page's code that fails to load is usually a redeploy (new file names) or a blip, and the browser
// remembers the failed import: one reload fixes both. Not again within a minute, so it never loops.
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY))
    if (last && Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * The layout route's error page: header and tab bar stay, so the visitor can go elsewhere. A
 * catalog file that did not arrive can be tried again in place; a page's code that failed reloads.
 */
export function AppError() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  const chunk = CHUNK_ERROR.test(String((error as Error | undefined)?.message ?? error))
  const [reloading] = useState(() => chunk && reloadOnce())
  const loading = revalidator.state === 'loading'
  const catalog =
    !chunk && /^catalog file/.test(String((error as Error | undefined)?.message ?? ''))
  return (
    <div className={FRAME}>
      {loading && <div aria-hidden className="nav-progress" />}
      <Header />
      <TabBar />
      <main
        id="main"
        tabIndex={-1}
        className="grid flex-1 place-items-center px-6 py-16 text-center"
      >
        {!reloading && (
          <div>
            <h1 className="font-display text-title text-ink">
              {catalog ? 'Couldn’t load the video list' : 'Something went wrong'}
            </h1>
            <p className="mt-2 text-ink-2">
              {catalog
                ? 'Check your connection, then try again.'
                : 'Please reload the page to try again.'}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => (catalog ? revalidator.revalidate() : window.location.reload())}
              className="mt-6 rounded-pill bg-action px-5 py-2.5 font-semibold text-on-action transition hover:bg-action-2 disabled:opacity-60"
            >
              {catalog ? (loading ? 'Trying…' : 'Try again') : 'Reload'}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default function AppLayout() {
  useGlobalShortcuts()
  useSpatialNavigation()
  useReturnFocus()
  useWarmRecommender()
  useEffect(installFocusMarks, [])
  // Closed until asked for (a key or a link): never part of the first frame.
  const painted = usePainted()

  return (
    // Bottom padding keeps the footer clear of the phone tab bar.
    <div className={FRAME}>
      {/* Tab only: the clipped link is no target for the arrow keys. */}
      <a
        href="#main"
        onClick={skipToMain}
        data-spatial="skip"
        className="sr-only z-50 rounded-pill bg-action bg-(image:--gradient-action) font-semibold text-on-action shadow-(--shadow-action) focus:not-sr-only focus-visible:shadow-[var(--shadow-action),var(--shadow-glow)] focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <NavProgress />
      <Header />
      <TabBar />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <DetailModal />
      {painted && <ShortcutsSheet />}
      {painted && <PrivacyDialog />}
      <RouteAnnouncer />
    </div>
  )
}
