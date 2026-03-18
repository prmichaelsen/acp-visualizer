import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, Flag, CheckSquare, Clock, Search, PenTool, Puzzle, FileBarChart, Github, X } from 'lucide-react'
import { ProjectSelector } from './ProjectSelector'
import { GitHubInput } from './GitHubInput'
import { GitHubAuth } from './GitHubAuth'
import type { AcpProject } from '../services/projects.service'

const navItems = [
  { to: '/' as const, icon: LayoutDashboard, label: 'Overview' },
  { to: '/milestones' as const, icon: Flag, label: 'Milestones' },
  { to: '/tasks' as const, icon: CheckSquare, label: 'Tasks' },
  { to: '/activity' as const, icon: Clock, label: 'Activity' },
  { to: '/designs' as const, icon: PenTool, label: 'Designs' },
  { to: '/patterns' as const, icon: Puzzle, label: 'Patterns' },
  { to: '/reports' as const, icon: FileBarChart, label: 'Reports' },
  { to: '/github' as const, icon: Github, label: 'GitHub' },
]

interface SidebarProps {
  projects?: AcpProject[]
  currentProject?: string | null
  onProjectSelect?: (projectId: string) => void
  onGitHubLoad?: (owner: string, repo: string) => Promise<void>
  onClose?: () => void
}

export function Sidebar({ projects = [], currentProject = null, onProjectSelect, onGitHubLoad, onClose }: SidebarProps) {
  const location = useRouterState({ select: (s) => s.location })

  return (
    <nav className="w-full lg:w-56 h-auto max-h-[80vh] lg:h-full border-t lg:border-t-0 lg:border-r border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-950 flex flex-col shrink-0 rounded-t-2xl lg:rounded-none overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
          ACP Visualizer
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          </button>
        )}
      </div>
      {projects.length > 1 && onProjectSelect && (
        <div className="px-3 pt-3">
          <ProjectSelector
            projects={projects}
            currentProject={currentProject}
            onSelect={onProjectSelect}
          />
        </div>
      )}
      <div className="py-2">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-800/50'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-800/30'
              }`}
              onClick={onClose}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
      <hr className="border-gray-200 dark:border-gray-800" />
      <div className="p-3 space-y-2">
        <Link
          to="/search"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-500 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-800 rounded-md hover:text-gray-900 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
          onClick={onClose}
        >
          <Search className="w-4 h-4" />
          Search...
        </Link>
        <GitHubAuth />
        {onGitHubLoad && (
          <GitHubInput onLoad={onGitHubLoad} />
        )}
      </div>
    </nav>
  )
}
