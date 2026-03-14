import { createFileRoute } from '@tanstack/react-router'
import { StatusBadge } from '../components/StatusBadge'
import { ProgressBar } from '../components/ProgressBar'
import { BurndownChart } from '../components/BurndownChart'
import { useProgressData } from '../contexts/ProgressContext'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const progressData = useProgressData()

  if (!progressData) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-red-400 font-medium">Failed to load progress data</p>
          <p className="text-red-400/70 text-sm mt-1">
            Check that progress.yaml exists and is valid YAML
          </p>
        </div>
      </div>
    )
  }

  const data = progressData

  return (
    <div className="p-6 space-y-6">
      {/* Project Metadata */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{data.project.name}</h2>
            <p className="text-gray-400 text-sm mt-1">{data.project.description}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 font-mono">v{data.project.version}</span>
            <div className="mt-1">
              <StatusBadge status={data.project.status} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Overall Progress</span>
            <div className="flex-1">
              <ProgressBar value={data.progress.overall} />
            </div>
            <span className="text-sm font-mono text-gray-300">{data.progress.overall}%</span>
          </div>
        </div>
      </div>

      {/* Milestones Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Milestones ({data.milestones.length})
        </h3>
        <div className="space-y-2">
          {data.milestones.map((m) => (
            <div
              key={m.id}
              className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4"
            >
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <StatusBadge status={m.status} />
              <div className="w-24">
                <ProgressBar value={m.progress} size="sm" />
              </div>
              <span className="text-xs text-gray-500 font-mono w-16 text-right">
                {m.tasks_completed}/{m.tasks_total}
              </span>
            </div>
          ))}
          {data.milestones.length === 0 && (
            <p className="text-gray-600 text-sm">No milestones defined</p>
          )}
        </div>
      </div>

      {/* Burndown Chart */}
      <BurndownChart data={data} />

      {/* Next Steps */}
      {data.next_steps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Next Steps
          </h3>
          <ul className="space-y-1.5">
            {data.next_steps.map((step, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-gray-600 mt-0.5">•</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers */}
      {data.current_blockers.length > 0 && (
        <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">
            Blockers
          </h3>
          <ul className="space-y-1">
            {data.current_blockers.map((blocker, i) => (
              <li key={i} className="text-sm text-red-300">
                {blocker}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
