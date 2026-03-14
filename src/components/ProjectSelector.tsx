import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { AcpProject } from '../services/projects.service'

interface ProjectSelectorProps {
  projects: AcpProject[]
  currentProject: string | null
  onSelect: (projectId: string) => void
}

export function ProjectSelector({
  projects,
  currentProject,
  onSelect,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false)

  const available = projects.filter((p) => p.hasProgress)
  const current = available.find((p) => p.id === currentProject)

  if (available.length <= 1) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 bg-gray-900 border border-gray-800 rounded-md hover:text-gray-300 hover:border-gray-600 transition-colors"
      >
        <span className="truncate">
          {current?.id || 'Select project'}
        </span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
            {available.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelect(p.id)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  p.id === currentProject
                    ? 'bg-gray-800 text-gray-100'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                <div className="font-medium truncate">{p.id}</div>
                {p.description && p.description !== 'No description' && (
                  <div className="text-gray-600 truncate mt-0.5">{p.description}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
