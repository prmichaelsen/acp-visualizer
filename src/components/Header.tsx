import { Moon, Sun } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { ProgressBar } from './ProgressBar'
import { useTheme } from '../lib/useTheme'
import type { ProgressData } from '../lib/types'

interface HeaderProps {
  data: ProgressData | null
}

export function Header({ data }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  if (!data) return null

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center pl-16 lg:pl-6 pr-4 lg:pr-6 gap-2 lg:gap-4 shrink-0 bg-white dark:bg-gray-950">
      <h1 className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">{data.project.name}</h1>
      <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-500 font-mono">v{data.project.version}</span>
      <div className="hidden sm:block">
        <StatusBadge status={data.project.status} />
      </div>
      <div className="ml-auto flex items-center gap-2 lg:gap-4">
        <div className="hidden md:flex items-center gap-3 w-32 lg:w-48">
          <ProgressBar value={data.progress.overall} size="sm" />
          <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{data.progress.overall}%</span>
        </div>
        <span className="md:hidden text-xs text-gray-600 dark:text-gray-400 font-mono">{data.progress.overall}%</span>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-gray-400" />
          ) : (
            <Sun className="w-4 h-4 text-gray-600" />
          )}
        </button>
      </div>
    </header>
  )
}
