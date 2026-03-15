import { createFileRoute } from '@tanstack/react-router'
import { DocumentDetail } from '../components/DocumentDetail'

export const Route = createFileRoute('/patterns/$slug')({
  component: PatternDetailPage,
})

function PatternDetailPage() {
  const { slug } = Route.useParams()
  return (
    <DocumentDetail
      slug={slug}
      dirPath="agent/patterns"
      sectionLabel="Patterns"
      sectionHref="/patterns"
    />
  )
}
