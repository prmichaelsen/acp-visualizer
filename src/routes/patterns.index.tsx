import { createFileRoute } from '@tanstack/react-router'
import { DocumentList } from '../components/DocumentList'

export const Route = createFileRoute('/patterns/')({
  component: PatternsPage,
})

function PatternsPage() {
  return <DocumentList title="Patterns" dirPath="agent/patterns" baseTo="/patterns" />
}
