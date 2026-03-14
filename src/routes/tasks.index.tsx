import { createFileRoute, Link } from '@tanstack/react-router'
import { StatusDot } from '../components/StatusDot'
import { ExtraFieldsBadge } from '../components/ExtraFieldsBadge'
import { useProgressData } from '../contexts/ProgressContext'
import type { Task } from '../lib/types'

export const Route = createFileRoute('/tasks/')({
  component: TasksPage,
})

function TasksPage() {
  const progressData = useProgressData()

  if (!progressData) {
    return (
      <div className="p-6">
        <p className="text-gray-600 text-sm">No data loaded</p>
      </div>
    )
  }

  const allTasks: Array<Task & { milestoneName: string }> = []
  for (const milestone of progressData.milestones) {
    const tasks = progressData.tasks[milestone.id] || []
    for (const task of tasks) {
      allTasks.push({ ...task, milestoneName: milestone.name })
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">
        All Tasks ({allTasks.length})
      </h2>
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        {allTasks.map((task) => (
          <Link
            key={task.id}
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
          >
            <StatusDot status={task.status} />
            <span
              className={`flex-1 text-sm ${
                task.status === 'completed' ? 'text-gray-500' : 'text-gray-200'
              }`}
            >
              {task.name}
            </span>
            <span className="text-xs text-gray-600">{task.milestoneName}</span>
            <span className="text-xs text-gray-500 font-mono w-8 text-right">
              {task.estimated_hours}h
            </span>
            <ExtraFieldsBadge fields={task.extra} />
          </Link>
        ))}
        {allTasks.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-gray-600 text-sm">No tasks defined</p>
          </div>
        )}
      </div>
    </div>
  )
}
