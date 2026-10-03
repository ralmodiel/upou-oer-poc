import { createBrowserRouter, Outlet, ScrollRestoration } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import AppLayout from './layouts/AppLayout'
import BrowsePage from './pages/BrowsePage'
import SearchPage from './pages/SearchPage'
import MyListPage from './pages/MyListPage'
import CollectionsPage from './pages/CollectionsPage'
import CategoryPage from './pages/CategoryPage'
import NotFoundPage from './pages/NotFoundPage'

// Wraps every route so scroll positions survive a trip to the watch page.
function Root() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
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
          className="mt-6 rounded-pill bg-maroon px-5 py-2.5 font-semibold text-on-accent transition hover:bg-maroon-2"
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
          children: [
            { index: true, Component: BrowsePage },
            { path: 'search', Component: SearchPage },
            { path: 'my-list', Component: MyListPage },
            { path: 'collections', Component: CollectionsPage },
            { path: 'collections/:slug', Component: CategoryPage },
            {
              // Reel + player are loaded on demand.
              path: 'watch/:id',
              lazy: async () => ({ Component: (await import('./pages/WatchPage')).default }),
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

export default function App() {
  return <RouterProvider router={router} />
}
