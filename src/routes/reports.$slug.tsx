import { createFileRoute } from '@tanstack/react-router'
import { DocumentDetail } from '../components/DocumentDetail'

export const Route = createFileRoute('/reports/$slug')({
  component: ReportDetailPage,
})

function ReportDetailPage() {
  const { slug } = Route.useParams()
  return (
    <DocumentDetail
      slug={slug}
      dirPath="agent/reports"
      sectionLabel="Reports"
      sectionHref="/reports"
    />
  )
}
