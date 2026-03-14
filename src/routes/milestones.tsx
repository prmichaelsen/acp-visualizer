import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/milestones')({
  component: MilestonesPage,
})

function MilestonesPage() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Milestones</h2>
      <p className="text-gray-500 text-sm">Milestone views coming soon...</p>
    </div>
  )
}
