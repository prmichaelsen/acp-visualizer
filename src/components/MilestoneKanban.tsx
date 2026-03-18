import { Link } from '@tanstack/react-router'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { ProgressBar } from './ProgressBar'
import { PreviewButton } from './PreviewButton'
import { TaskList } from './TaskList'
import { formatMilestoneName } from '../lib/display'
import type { Milestone, Task, Status } from '../lib/types'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

const columns: Array<{ status: Status; label: string; color: string }> = [
  { status: 'not_started', label: 'Not Started', color: 'border-gray-600' },
  { status: 'in_progress', label: 'In Progress', color: 'border-blue-500' },
  { status: 'completed', label: 'Completed', color: 'border-green-500' },
  { status: 'wont_do', label: "Won't Do", color: 'border-yellow-500' },
]

interface MilestoneKanbanProps {
  milestones: Milestone[]
  tasks: Record<string, Task[]>
}

function KanbanCard({
  milestone,
  tasks,
}: {
  milestone: Milestone
  tasks: Task[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <Link
            to="/milestones/$milestoneId"
            params={{ milestoneId: milestone.id }}
            className="text-sm font-medium leading-tight text-gray-900 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            {formatMilestoneName(milestone)}
          </Link>
          <PreviewButton type="milestone" id={milestone.id} />
        </div>
        <PriorityBadge priority={milestone.priority} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <ProgressBar value={milestone.progress} size="sm" />
        </div>
        <span className="text-xs text-gray-500 font-mono">
          {milestone.tasks_completed}/{milestone.tasks_total}
        </span>
      </div>
      {milestone.notes && (
        <p className="text-xs text-gray-500 truncate mb-2">{milestone.notes}</p>
      )}
      {tasks.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </button>
      )}
      {expanded && (
        <div className="mt-2 border-t border-gray-800 pt-2">
          <TaskList tasks={tasks} />
        </div>
      )}
    </div>
  )
}

export function MilestoneKanban({ milestones, tasks }: MilestoneKanbanProps) {
  if (milestones.length === 0) {
    return <p className="text-gray-600 text-sm">No milestones</p>
  }

  // Only show columns that have items, except always show the core 3
  const coreStatuses = new Set<Status>(['not_started', 'in_progress', 'completed'])
  const activeColumns = columns.filter(
    (col) =>
      coreStatuses.has(col.status) ||
      milestones.some((m) => m.status === col.status),
  )

  // Responsive grid: 1 col mobile, 2 cols tablet, 3-4 cols desktop
  const gridCols = activeColumns.length <= 3
    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid ${gridCols} gap-4 min-h-[300px]`}>
      {activeColumns.map((col) => {
        const items = milestones.filter((m) => m.status === col.status)
        return (
          <div key={col.status} className="flex flex-col">
            <div
              className={`flex items-center gap-2 pb-3 mb-3 border-b-2 ${col.color}`}
            >
              <h3 className="text-sm font-medium text-gray-300">{col.label}</h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>
            <div className="space-y-2 flex-1">
              {items.map((m) => (
                <KanbanCard
                  key={m.id}
                  milestone={m}
                  tasks={tasks[m.id] || []}
                />
              ))}
              {items.length === 0 && (
                <p className="text-xs text-gray-700 text-center py-4">
                  No milestones
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
