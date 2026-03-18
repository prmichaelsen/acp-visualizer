export type ViewMode = 'table' | 'tree' | 'kanban' | 'gantt' | 'graph'

interface ViewToggleProps {
  value: ViewMode
  onChange: (view: ViewMode) => void
}

const views: Array<{ id: ViewMode; label: string }> = [
  { id: 'table', label: 'Table' },
  { id: 'tree', label: 'Tree' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'gantt', label: 'Gantt' },
  { id: 'graph', label: 'Graph' },
]

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5 overflow-x-auto scrollbar-hide">
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => onChange(v.id)}
          className={`px-4 py-2 text-sm rounded-md transition-colors whitespace-nowrap min-w-[44px] min-h-[44px] flex items-center justify-center ${
            value === v.id
              ? 'bg-gray-700 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}
