import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { MilestoneTable } from '@/components/MilestoneTable'
import { MilestoneTree } from '@/components/MilestoneTree'
import { ViewToggle } from '@/components/ViewToggle'

export const Route = createFileRoute('/milestones')({
  component: MilestonesPage,
})

function MilestonesPage() {
  const { progressData } = Route.useRouteContext()
  const [view, setView] = useState<'table' | 'tree'>('table')

  if (!progressData) {
    return (
      <div className="p-6">
        <p className="text-gray-600 text-sm">No data loaded</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Milestones</h2>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'table' ? (
        <MilestoneTable
          milestones={progressData.milestones}
          tasks={progressData.tasks}
        />
      ) : (
        <MilestoneTree
          milestones={progressData.milestones}
          tasks={progressData.tasks}
        />
      )}
    </div>
  )
}
