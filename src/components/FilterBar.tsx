import type { Status } from '../lib/types'

const statusOptions: Array<{ value: Status | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'completed', label: 'Completed' },
  { value: 'wont_do', label: "Won't Do" },
]

interface FilterBarProps {
  status: Status | 'all'
  onStatusChange: (status: Status | 'all') => void
}

export function FilterBar({ status, onStatusChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2 p-2 bg-gray-800/50 rounded-lg">
      {statusOptions.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onStatusChange(opt.value)}
          className={`px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap min-w-[44px] min-h-[44px] flex items-center justify-center ${
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
