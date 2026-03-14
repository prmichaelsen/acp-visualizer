import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { MilestoneTable } from '../components/MilestoneTable'
import { MilestoneTree } from '../components/MilestoneTree'
import { ViewToggle } from '../components/ViewToggle'
import { FilterBar } from '../components/FilterBar'
import { SearchInput } from '../components/SearchInput'
import { useFilteredData } from '../lib/useFilteredData'
import type { Status } from '../lib/types'

export const Route = createFileRoute('/milestones')({
  component: MilestonesPage,
})

function MilestonesPage() {
  const { progressData } = Route.useRouteContext()
  const [view, setView] = useState<'table' | 'tree'>('table')
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')

  const filtered = useFilteredData(progressData, { status, search })

  if (!filtered) {
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
      <div className="flex items-center gap-3 mb-4">
        <FilterBar status={status} onStatusChange={setStatus} />
        <div className="w-64">
          <SearchInput value={search} onChange={setSearch} placeholder="Filter milestones..." />
        </div>
      </div>
      {view === 'table' ? (
        <MilestoneTable milestones={filtered.milestones} tasks={filtered.tasks} />
      ) : (
        <MilestoneTree milestones={filtered.milestones} tasks={filtered.tasks} />
      )}
    </div>
  )
}
