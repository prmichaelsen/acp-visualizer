import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, Flag, CheckSquare, Clock, Search, PenTool, Puzzle, FileBarChart } from 'lucide-react'
import { ProjectSelector } from './ProjectSelector'
import { GitHubInput } from './GitHubInput'
import type { AcpProject } from '../services/projects.service'

const navItems = [
  { to: '/' as const, icon: LayoutDashboard, label: 'Overview' },
  { to: '/milestones' as const, icon: Flag, label: 'Milestones' },
  { to: '/tasks' as const, icon: CheckSquare, label: 'Tasks' },
  { to: '/activity' as const, icon: Clock, label: 'Activity' },
  { to: '/designs' as const, icon: PenTool, label: 'Designs' },
  { to: '/patterns' as const, icon: Puzzle, label: 'Patterns' },
  { to: '/reports' as const, icon: FileBarChart, label: 'Reports' },
]

interface SidebarProps {
  projects?: AcpProject[]
  currentProject?: string | null
  onProjectSelect?: (projectId: string) => void
  onGitHubLoad?: (owner: string, repo: string) => Promise<void>
}

export function Sidebar({ projects = [], currentProject = null, onProjectSelect, onGitHubLoad }: SidebarProps) {
  const location = useRouterState({ select: (s) => s.location })

  return (
    <nav className="w-56 border-r border-gray-800 bg-gray-950 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-800">
        <span className="text-sm font-semibold text-gray-300 tracking-wide">
          ACP Visualizer
        </span>
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
      <div className="flex-1 py-2">
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
                  ? 'text-gray-100 bg-gray-800/50'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
      <div className="p-3 border-t border-gray-800 space-y-2">
        <Link
          to="/search"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-900 border border-gray-800 rounded-md hover:text-gray-300 hover:border-gray-600 transition-colors"
        >
          <Search className="w-4 h-4" />
          Search...
        </Link>
        {onGitHubLoad && (
          <GitHubInput onLoad={onGitHubLoad} />
        )}
      </div>
    </nav>
  )
}
