import { createFileRoute } from '@tanstack/react-router'
import { DocumentList } from '../components/DocumentList'

export const Route = createFileRoute('/reports/')({
  component: ReportsPage,
})

function ReportsPage() {
  return <DocumentList title="Reports" dirPath="agent/reports" baseTo="/reports" />
}
