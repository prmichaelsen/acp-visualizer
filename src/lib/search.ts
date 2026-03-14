import Fuse from 'fuse.js'
import type { ProgressData, Milestone, Task } from './types'

export interface SearchItem {
  type: 'milestone' | 'task'
  milestone: Milestone
  task?: Task
  name: string
  notes: string
  extra: string
}

export function buildSearchIndex(data: ProgressData) {
  const items: SearchItem[] = []

  for (const milestone of data.milestones) {
    items.push({
      type: 'milestone',
      milestone,
      name: milestone.name,
      notes: milestone.notes,
      extra: JSON.stringify(milestone.extra),
    })

    const tasks = data.tasks[milestone.id] || []
    for (const task of tasks) {
      items.push({
        type: 'task',
        milestone,
        task,
        name: task.name,
        notes: task.notes,
        extra: JSON.stringify(task.extra),
      })
    }
  }

  return new Fuse(items, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'notes', weight: 1 },
      { name: 'extra', weight: 0.5 },
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true,
  })
}
