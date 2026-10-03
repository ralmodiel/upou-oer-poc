import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block underline">
        Back to Browse
      </Link>
    </div>
  )
}
