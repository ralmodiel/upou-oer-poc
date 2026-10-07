import type { MouseEvent } from 'react'
import { Outlet, useNavigation } from 'react-router'
import DetailModal from '../components/DetailModal'
import Footer from '../components/Footer'
import Header, { TabBar } from '../components/Header'
import PrivacyDialog from '../components/PrivacyDialog'
import ShortcutsSheet from '../components/ShortcutsSheet'
import { usePainted } from '../components/browse-hooks'
import { useReturnFocus } from '../components/hooks'
import { useWarmRecommender } from '../components/recs'
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
      <Header />
      <TabBar />
      <main className="flex-1" />
    </div>
  )
}

export default function AppLayout() {
  useGlobalShortcuts()
  useSpatialNavigation()
  useReturnFocus()
  useWarmRecommender()
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
    </div>
  )
}
