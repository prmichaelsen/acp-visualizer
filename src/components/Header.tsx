import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import type { ProgressData } from '../lib/types'

interface HeaderProps {
  data: ProgressData | null
}

export function Header({ data }: HeaderProps) {
  if (!data) return null

  return (
    <header className="h-14 border-b border-gray-800 flex items-center px-6 gap-4 shrink-0">
      <h1 className="text-sm font-medium text-gray-200">{data.project.name}</h1>
      <span className="text-xs text-gray-500 font-mono">v{data.project.version}</span>
      <StatusBadge status={data.project.status} />
      <div className="ml-auto flex items-center gap-3 w-48">
        <ProgressBar value={data.progress.overall} size="sm" />
        <span className="text-xs text-gray-400 font-mono">{data.progress.overall}%</span>
      </div>
    </header>
  )
}
