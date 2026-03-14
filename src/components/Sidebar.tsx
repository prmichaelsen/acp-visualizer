import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, Flag, CheckSquare, Search } from 'lucide-react'

const navItems = [
  { to: '/' as const, icon: LayoutDashboard, label: 'Overview' },
  { to: '/milestones' as const, icon: Flag, label: 'Milestones' },
  { to: '/tasks' as const, icon: CheckSquare, label: 'Tasks' },
]

export function Sidebar() {
  const location = useRouterState({ select: (s) => s.location })

  return (
    <nav className="w-56 border-r border-gray-800 bg-gray-950 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-800">
        <span className="text-sm font-semibold text-gray-300 tracking-wide">
          ACP Visualizer
        </span>
      </div>
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
      <div className="p-3 border-t border-gray-800">
        <Link
          to="/search"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-900 border border-gray-800 rounded-md hover:text-gray-300 hover:border-gray-600 transition-colors"
        >
          <Search className="w-4 h-4" />
          Search...
        </Link>
      </div>
    </nav>
  )
}
