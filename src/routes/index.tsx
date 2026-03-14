import { createFileRoute } from '@tanstack/react-router'
import { ProgressDatabaseService } from '@/services/progress-database.service'
import type { ProgressData } from '@/lib/types'
import type { ProgressResult } from '@/services/progress-database.service'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    let progressResult: ProgressResult = {
      ok: false,
      error: 'FILE_NOT_FOUND',
      message: 'Not loaded yet',
      path: '',
    }

    try {
      progressResult = ProgressDatabaseService.getProgressData()
    } catch (error) {
      console.error('[Index] Failed to load progress data:', error)
    }

    return { progressResult }
  },
  component: HomePage,
})

function HomePage() {
  const { progressResult } = Route.useRouteContext()

  if (!progressResult.ok) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">ACP Progress Visualizer</h1>
        <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400 font-medium">{progressResult.error}</p>
          <p className="text-red-400/70 text-sm mt-1">{progressResult.message}</p>
          {progressResult.path && (
            <p className="text-gray-500 text-xs mt-2 font-mono">Path: {progressResult.path}</p>
          )}
        </div>
      </div>
    )
  }

  const data: ProgressData = progressResult.data

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{data.project.name}</h1>
      <p className="text-gray-400 text-sm mt-1">
        v{data.project.version} — {data.project.status.replace('_', ' ')}
      </p>
      <p className="text-gray-500 text-sm mt-2">{data.project.description}</p>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">
          Milestones ({data.milestones.length})
        </h2>
        {data.milestones.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-4 py-2 border-b border-gray-800"
          >
            <span className="text-sm font-mono text-gray-500 w-20">{m.id}</span>
            <span className="flex-1 text-sm">{m.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              m.status === 'completed'
                ? 'bg-green-500/15 text-green-400'
                : m.status === 'in_progress'
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-gray-500/15 text-gray-500'
            }`}>
              {m.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500 font-mono w-16 text-right">
              {m.progress}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Next Steps</h2>
        <ul className="space-y-1">
          {data.next_steps.map((step, i) => (
            <li key={i} className="text-sm text-gray-400">
              • {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
