import { createFileRoute } from '@tanstack/react-router'
import { DocumentDetail } from '../components/DocumentDetail'

export const Route = createFileRoute('/designs/$slug')({
  component: DesignDetailPage,
})

function DesignDetailPage() {
  const { slug } = Route.useParams()
  return (
    <DocumentDetail
      slug={slug}
      dirPath="agent/design"
      sectionLabel="Designs"
      sectionHref="/designs"
    />
  )
}
