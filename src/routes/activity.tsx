import { createFileRoute } from '@tanstack/react-router'
import { useProgressData } from '../contexts/ProgressContext'

export const Route = createFileRoute('/activity')({
  component: ActivityPage,
})

function ActivityPage() {
  const progressData = useProgressData()

  if (!progressData) {
    return (
      <div className="p-6">
        <p className="text-gray-600 text-sm">No data loaded</p>
      </div>
    )
  }

  const entries = progressData.recent_work

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>

      {entries.length === 0 ? (
        <p className="text-gray-600 text-sm">No recent work entries</p>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-800" />

          <div className="space-y-6">
            {entries.map((entry, i) => (
              <div key={i} className="relative flex gap-4">
                {/* Timeline dot */}
                <div className="relative z-10 mt-1">
                  <div className="w-[9px] h-[9px] rounded-full bg-blue-500 ring-4 ring-gray-950" />
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs text-gray-500 font-mono">
                      {entry.date}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mb-2">
                    {entry.description}
                  </p>
                  {entry.items.length > 0 && (
                    <ul className="space-y-1">
                      {entry.items.map((item, j) => (
                        <li
                          key={j}
                          className="text-xs text-gray-400 flex items-start gap-2"
                        >
                          <span className="text-gray-600 mt-0.5">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  {Object.keys(entry.extra).length > 0 && (
                    <div className="mt-2 text-xs text-gray-600">
                      {Object.entries(entry.extra).map(([k, v]) => (
                        <span key={k} className="mr-3">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes section */}
      {progressData.notes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Notes
          </h3>
          <ul className="space-y-1.5">
            {progressData.notes.map((note, i) => (
              <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                <span className="text-gray-600 mt-0.5">•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
