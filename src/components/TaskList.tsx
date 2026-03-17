import { Link } from '@tanstack/react-router'
import { StatusDot } from './StatusDot'
import { PriorityBadge } from './PriorityBadge'
import { ExtraFieldsBadge } from './ExtraFieldsBadge'
import type { Task } from '../lib/types'

export function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="pl-6 py-2">
        <span className="text-xs text-gray-600">No tasks</span>
      </div>
    )
  }

  return (
    <div className="pl-6 py-1 space-y-0.5">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2 py-1 text-sm">
          <StatusDot status={task.status} />
          <Link
            to="/tasks/$taskId"
            params={{ taskId: task.id }}
            className={`hover:text-blue-400 transition-colors ${
              task.status === 'completed' ? 'text-gray-500' : 'text-gray-200'
            }`}
          >
            {task.name}
          </Link>
          <PriorityBadge priority={task.priority} />
          {task.notes && (
            <span className="text-xs text-gray-600 ml-auto truncate max-w-[200px]">
              {task.notes}
            </span>
          )}
          <ExtraFieldsBadge fields={task.extra} />
        </div>
      ))}
    </div>
  )
}
