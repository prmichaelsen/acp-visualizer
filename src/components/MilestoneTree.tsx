import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { ProgressBar } from './ProgressBar'
import { PreviewButton } from './PreviewButton'
import { TaskList } from './TaskList'
import { useCollapse } from '../lib/useCollapse'
import type { Milestone, Task } from '../lib/types'

interface MilestoneTreeProps {
  milestones: Milestone[]
  tasks: Record<string, Task[]>
}

function MilestoneTreeRow({
  milestone,
  tasks,
  expanded,
  onToggle,
}: {
  milestone: Milestone
  tasks: Task[]
  expanded: boolean
  onToggle: () => void
}) {
  const collapse = useCollapse(expanded)

  return (
    <div className="border-b border-gray-200 dark:border-gray-800/50 group">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-200/50 dark:hover:bg-gray-800/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-500 shrink-0" />
        )}
        <div className="flex items-center gap-2 flex-1">
          <Link
            to="/milestones/$milestoneId"
            params={{ milestoneId: milestone.id }}
            className="text-sm font-medium text-gray-900 dark:text-gray-200 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {milestone.name}
          </Link>
          <PreviewButton type="milestone" id={milestone.id} />
        </div>
        <StatusBadge status={milestone.status} />
        <PriorityBadge priority={milestone.priority} />
        <div className="w-20">
          <ProgressBar value={milestone.progress} size="sm" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-500 font-mono w-12 text-right">
          {milestone.tasks_completed}/{milestone.tasks_total}
        </span>
      </button>
      <div ref={collapse.ref} style={collapse.style}>
        <div className="px-4 pb-2">
          <TaskList tasks={tasks} />
        </div>
      </div>
    </div>
  )
}

export function MilestoneTree({ milestones, tasks }: MilestoneTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (milestones.length === 0) {
    return <p className="text-gray-600 text-sm">No milestones</p>
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      {milestones.map((milestone) => (
        <MilestoneTreeRow
          key={milestone.id}
          milestone={milestone}
          tasks={tasks[milestone.id] || []}
          expanded={expanded.has(milestone.id)}
          onToggle={() => toggle(milestone.id)}
        />
      ))}
    </div>
  )
}
