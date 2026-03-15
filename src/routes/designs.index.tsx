import { createFileRoute } from '@tanstack/react-router'
import { DocumentList } from '../components/DocumentList'

export const Route = createFileRoute('/designs/')({
  component: DesignsPage,
})

function DesignsPage() {
  return <DocumentList title="Designs" dirPath="agent/design" baseTo="/designs" />
}
