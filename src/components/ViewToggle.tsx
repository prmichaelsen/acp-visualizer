interface ViewToggleProps {
  value: 'table' | 'tree'
  onChange: (view: 'table' | 'tree') => void
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
      <button
        onClick={() => onChange('table')}
        className={`px-3 py-1 text-xs rounded-md transition-colors ${
          value === 'table'
            ? 'bg-gray-700 text-gray-100'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        Table
      </button>
      <button
        onClick={() => onChange('tree')}
        className={`px-3 py-1 text-xs rounded-md transition-colors ${
          value === 'tree'
            ? 'bg-gray-700 text-gray-100'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        Tree
      </button>
    </div>
  )
}
