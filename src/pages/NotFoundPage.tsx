import NotFound from '../components/ui/NotFound'
import '../components/pages.css'
import { pageTitle, useSeo } from '../lib/seo'

export default function NotFoundPage() {
  useSeo({
    title: pageTitle('Page not found'),
    description: 'There is nothing at this address.',
    noindex: true,
  })
  return (
    <NotFound className="tv-spot-page" eyebrow="Error 404" title="Page not found">
      There is nothing at this address. The link may be old or mistyped.
    </NotFound>
  )
}
