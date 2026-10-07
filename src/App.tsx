import { useSyncExternalStore } from 'react'
import { createBrowserRouter, Navigate, Outlet, replace, ScrollRestoration } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { catalogRoute } from './data/catalog'
import { loadCite } from './data/cites'
import AppLayout, { AppError, AppFallback } from './layouts/AppLayout'
import { directoryPath, lowerCaseIds } from './lib/seo'
import BrowsePage from './pages/BrowsePage'
import SearchPage from './pages/SearchPage'
import MyListPage from './pages/MyListPage'
import CollectionsPage from './pages/CollectionsPage'
import CategoryPage from './pages/CategoryPage'
import NotFoundPage from './pages/NotFoundPage'

// Wraps every route so scroll positions survive a trip to the watch page.
function Root() {
  // A reload of a lazy route (the watch page) shows its short fallback first. Restoring then
  // clamps the position to that fallback, or scroll anchoring on the footer pushes it down by
  // the page's height when the page replaces it; so restoring waits until the route has loaded.
  const loaded = useSyncExternalStore(router.subscribe, () => router.state.initialized)
  return (
    <>
      <Outlet />
      {/* Fresh loads of a different URL start at the top; reloads and Back still restore. */}
      {loaded && (
        <ScrollRestoration
          getKey={(location) =>
            location.key === 'default' ? location.pathname + location.search : location.key
          }
        />
      )}
    </>
  )
}

// Replaces a blank screen if a page crashes or a chunk fails to load (e.g. after a redeploy).
function RootError() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="font-display text-title text-ink">Something went wrong</h1>
        <p className="mt-2 text-ink-2">Please reload the page to try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-pill bg-action px-5 py-2.5 font-semibold text-on-action transition hover:bg-action-2"
        >
          Reload
        </button>
      </div>
    </main>
  )
}

const router = createBrowserRouter(
  [
    {
      Component: Root,
      ErrorBoundary: RootError,
      children: [
        {
          path: '/',
          Component: AppLayout,
          // The rest of the catalog arrives after the first paint; a page that needs it waits here.
          ...catalogRoute,
          // A link in capitals goes to its page first: the catalog would look in the wrong file.
          loader: (args: { request: Request }) => {
            const lower = lowerCaseIds(args.request.url)
            return lower ? replace(lower) : catalogRoute.loader(args)
          },
          HydrateFallback: AppFallback,
          ErrorBoundary: AppError,
          children: [
            { index: true, Component: BrowsePage },
            // GitHub Pages serves the home at /index.html too.
            { path: 'index.html', element: <Navigate to="/" replace /> },
            { path: 'search', Component: SearchPage },
            { path: 'my-list', Component: MyListPage },
            { path: 'collections', Component: CollectionsPage },
            { path: 'collections/:slug', Component: CategoryPage },
            {
              // Reel + player are loaded on demand.
              path: 'watch/:id',
              // cites.json (3 KB) comes with it, so How to cite is in the page's first paint
              // rather than pushing the description down when it lands (or a restored scroll).
              lazy: async () => {
                const [page] = await Promise.all([
                  import('./pages/WatchPage'),
                  loadCite('').catch(() => undefined),
                ])
                return { Component: page.default }
              },
              HydrateFallback: () => <div className="min-h-dvh" />,
            },
            { path: '*', Component: NotFoundPage },
          ],
        },
      ],
    },
  ],
  {
    // Matches Vite's `base`, e.g. "/upou-networks" on GitHub Pages.
    basename: import.meta.env.BASE_URL.replace(/(.)\/$/, '$1'),
  },
)

// Pages answers "/watch/x" with a 301 to "/watch/x/", and the browser drops the entry's
// history.state on that redirect: reloading a page reached in the app lost its scroll position,
// its Up next playlist and where Back goes. So the address bar shows the form Pages serves.
router.subscribe(() => {
  const { pathname, search, hash } = window.location
  const path = directoryPath(pathname)
  if (path !== pathname) window.history.replaceState(window.history.state, '', path + search + hash)
})

export default function App() {
  return <RouterProvider router={router} />
}
