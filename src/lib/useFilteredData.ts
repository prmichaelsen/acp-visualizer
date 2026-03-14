import { useMemo } from 'react'
import { buildSearchIndex } from './search'
import type { ProgressData, Status } from './types'

interface FilterState {
  status: Status | 'all'
  search: string
}

export function useFilteredData(
  data: ProgressData | null,
  filters: FilterState,
): ProgressData | null {
  return useMemo(() => {
    if (!data) return null

    let milestones = data.milestones
    let tasks = { ...data.tasks }

    // Status filter
    if (filters.status !== 'all') {
      milestones = milestones.filter((m) => m.status === filters.status)
      tasks = Object.fromEntries(
        Object.entries(tasks).map(([id, ts]) => [
          id,
          ts.filter((t) => t.status === filters.status),
        ]),
      )
    }

    // Search filter
    if (filters.search.trim()) {
      const index = buildSearchIndex(data)
      const results = index.search(filters.search)
      const matchedMilestoneIds = new Set(
        results.map((r) => r.item.milestone.id),
      )
      const matchedTaskIds = new Set(
        results.filter((r) => r.item.task).map((r) => r.item.task!.id),
      )

      milestones = milestones.filter((m) => matchedMilestoneIds.has(m.id))
      tasks = Object.fromEntries(
        Object.entries(tasks).map(([id, ts]) => [
          id,
          ts.filter(
            (t) => matchedTaskIds.has(t.id) || matchedMilestoneIds.has(id),
          ),
        ]),
      )
    }

    return { ...data, milestones, tasks }
  }, [data, filters.status, filters.search])
}
