import { createFileRoute } from '@tanstack/react-router'
import { useState, lazy, Suspense } from 'react'
import { MilestoneTable } from '../components/MilestoneTable'
import { MilestoneTree } from '../components/MilestoneTree'
import { MilestoneKanban } from '../components/MilestoneKanban'
import { MilestoneGantt } from '../components/MilestoneGantt'
import { ViewToggle, type ViewMode } from '../components/ViewToggle'
import { FilterBar } from '../components/FilterBar'
import { SearchInput } from '../components/SearchInput'
import { useFilteredData } from '../lib/useFilteredData'
import { useProgressData } from '../contexts/ProgressContext'
import type { Status } from '../lib/types'

// Lazy-load DependencyGraph to keep dagre out of the SSR bundle
// (dagre uses CommonJS require() which fails on Cloudflare Workers)
const DependencyGraph = lazy(() => import('../components/DependencyGraph').then(m => ({ default: m.DependencyGraph })))

export const Route = createFileRoute('/milestones')({
  component: MilestonesPage,
})

function MilestonesPage() {
  const progressData = useProgressData()
  const [view, setView] = useState<ViewMode>('table')
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
      {view !== 'kanban' && (
        <div className="flex items-center gap-3 mb-4">
          <FilterBar status={status} onStatusChange={setStatus} />
          <div className="w-64">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter milestones..." />
          </div>
        </div>
      )}
      {view === 'table' ? (
        <MilestoneTable milestones={filtered.milestones} tasks={filtered.tasks} />
      ) : view === 'tree' ? (
        <MilestoneTree milestones={filtered.milestones} tasks={filtered.tasks} />
      ) : view === 'kanban' ? (
        <MilestoneKanban milestones={filtered.milestones} tasks={filtered.tasks} />
      ) : view === 'gantt' ? (
        <MilestoneGantt milestones={filtered.milestones} tasks={filtered.tasks} />
      ) : (
        <Suspense fallback={<p className="text-gray-500 text-sm">Loading graph...</p>}>
          <DependencyGraph data={filtered} />
        </Suspense>
      )}
    </div>
  )
}
