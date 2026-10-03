import { useParams } from 'react-router'

export default function CategoryPage() {
  const { slug } = useParams()
  return <div className="p-8">Collection: {slug}</div>
}
