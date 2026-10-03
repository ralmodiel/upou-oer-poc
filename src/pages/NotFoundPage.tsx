import { useDocumentTitle } from '../components/hooks'
import LinkButton from '../components/ui/LinkButton'
import SectionHeading from '../components/ui/SectionHeading'

export default function NotFoundPage() {
  useDocumentTitle('Page not found · UPOU OER')
  return (
    <div className="px-(--gutter) pt-10 pb-16 sm:pt-14">
      <SectionHeading
        as="h1"
        eyebrow="Error 404"
        title="Page not found"
        description="There is nothing at this address. The link may be old or mistyped."
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <LinkButton to="/">Browse videos</LinkButton>
        <LinkButton to="/collections" variant="secondary">
          Collections
        </LinkButton>
      </div>
    </div>
  )
}
