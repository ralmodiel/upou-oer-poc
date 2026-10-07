import type { MouseEvent } from 'react'
import { Outlet } from 'react-router'
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

export default function AppLayout() {
  useGlobalShortcuts()
  useSpatialNavigation()
  useReturnFocus()
  useWarmRecommender()
  // Closed until asked for (a key or a link): never part of the first frame.
  const painted = usePainted()

  return (
    // Bottom padding keeps the footer clear of the phone tab bar.
    <div className="flex min-h-dvh flex-col pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] md:pb-0">
      {/* Tab only: the clipped link is no target for the arrow keys. */}
      <a
        href="#main"
        onClick={skipToMain}
        data-spatial="skip"
        className="sr-only z-50 rounded-pill bg-action bg-(image:--gradient-action) font-semibold text-on-action shadow-(--shadow-action) focus:not-sr-only focus-visible:shadow-[var(--shadow-action),var(--shadow-glow)] focus:fixed focus:top-3 focus:left-3 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
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
