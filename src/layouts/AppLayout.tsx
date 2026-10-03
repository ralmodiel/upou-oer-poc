import type { MouseEvent } from 'react'
import { Outlet } from 'react-router'
import DetailModal from '../components/DetailModal'
import Footer from '../components/Footer'
import Header from '../components/Header'
import '../components/browse.css'

// Move focus (not just scroll) so the next Tab starts inside the main content.
function skipToMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault()
  document.getElementById('main')?.focus()
}

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        onClick={skipToMain}
        className="sr-only z-50 rounded-md bg-white px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <DetailModal />
    </div>
  )
}
