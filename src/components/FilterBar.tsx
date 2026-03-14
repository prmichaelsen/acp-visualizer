import type { Status } from '@/lib/types'

const statusOptions: Array<{ value: Status | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
]

interface FilterBarProps {
  status: Status | 'all'
  onStatusChange: (status: Status | 'all') => void
}

export function FilterBar({ status, onStatusChange }: FilterBarProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg">
      {statusOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onStatusChange(opt.value)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            status === opt.value
              ? 'bg-gray-700 text-gray-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
