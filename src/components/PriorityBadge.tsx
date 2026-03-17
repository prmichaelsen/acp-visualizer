import type { Priority } from '../lib/types'

const priorityStyles: Record<Priority, string> = {
  critical: 'bg-rose-500/20 text-rose-400',
  high: 'bg-amber-500/20 text-amber-400',
  medium: 'bg-blue-500/20 text-blue-400',
  low: 'bg-zinc-500/20 text-zinc-400',
}

export function PriorityBadge({ priority }: { priority: Priority | undefined }) {
  if (!priority) return null

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium uppercase ${priorityStyles[priority] ?? priorityStyles.medium}`}
    >
      {priority}
    </span>
  )
}
