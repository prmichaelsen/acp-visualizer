import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { SearchInput } from '../components/SearchInput'
import { StatusBadge } from '../components/StatusBadge'
import { StatusDot } from '../components/StatusDot'
import { buildSearchIndex } from '../lib/search'

export const Route = createFileRoute('/search')({
  component: SearchPage,
})

function SearchPage() {
  const { progressData } = Route.useRouteContext()
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    if (!progressData || !query.trim()) return []
    const index = buildSearchIndex(progressData)
    return index.search(query).slice(0, 20)
  }, [progressData, query])

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Search</h2>
      <div className="max-w-md mb-6">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search milestones and tasks..."
        />
      </div>

      {query.trim() && results.length === 0 && (
        <p className="text-gray-500 text-sm">
          No results for "{query}"
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-3">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </p>
          {results.map((result, i) => (
            <div
              key={i}
              className="bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {result.item.type === 'task' && result.item.task ? (
                  <>
                    <StatusDot status={result.item.task.status} />
                    <span className="text-sm">{result.item.task.name}</span>
                    <span className="text-xs text-gray-600 ml-auto">
                      {result.item.milestone.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">
                      {result.item.milestone.name}
                    </span>
                    <StatusBadge status={result.item.milestone.status} />
                  </>
                )}
              </div>
              {result.item.notes && (
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {result.item.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!query.trim() && (
        <p className="text-gray-600 text-sm">
          Type to search across milestones and tasks
        </p>
      )}
    </div>
  )
}
