import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useProgressData } from '../contexts/ProgressContext'
import { Breadcrumb } from '../components/Breadcrumb'
import { DetailHeader } from '../components/DetailHeader'
import { PriorityBadge } from '../components/PriorityBadge'
import { MarkdownContent, buildLinkMap } from '../components/MarkdownContent'
import { getMarkdownContent } from '../services/markdown.service'
import { resolveTaskFile } from '../services/markdown.service'
import type { MarkdownResult } from '../services/markdown.service'

export const Route = createFileRoute('/tasks/$taskId')({
  component: TaskDetailPage,
})

/** Read ?repo=owner/repo from URL */
function getGitHubParams(): { owner: string; repo: string } | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const repo = params.get('repo')
  if (!repo) return undefined
  const parts = repo.split('/')
  if (parts.length < 2) return undefined
  return { owner: parts[0], repo: parts[1] }
}

function TaskDetailPage() {
  const { taskId } = Route.useParams()
  const data = useProgressData()
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Find the task and its parent milestone
  const { task, milestone, siblings } = useMemo(() => {
    if (!data) return { task: null, milestone: null, siblings: { prev: null, next: null } }

    for (const ms of data.milestones) {
      const msTaskList = data.tasks[ms.id] || []
      const idx = msTaskList.findIndex((t) => t.id === taskId)
      if (idx !== -1) {
        return {
          task: msTaskList[idx],
          milestone: ms,
          siblings: {
            prev: idx > 0 ? msTaskList[idx - 1] : null,
            next: idx < msTaskList.length - 1 ? msTaskList[idx + 1] : null,
          },
        }
      }
    }
    return { task: null, milestone: null, siblings: { prev: null, next: null } }
  }, [data, taskId])

  useEffect(() => {
    if (!task) return

    setLoading(true)
    setMarkdown(null)
    setMarkdownError(null)

    const filePath = resolveTaskFile(task)
    if (!filePath) {
      setMarkdownError('No file path for this task')
      setLoading(false)
      return
    }

    const github = getGitHubParams()

    getMarkdownContent({ data: { filePath, github } })
      .then((result: MarkdownResult) => {
        if (result.ok) {
          setMarkdown(result.content)
        } else {
          setMarkdownError(result.error)
        }
      })
      .catch((err: Error) => {
        setMarkdownError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [task])

  const linkMap = useMemo(() => (data ? buildLinkMap(data) : {}), [data])
  const taskFilePath = useMemo(() => resolveTaskFile(task), [task])

  if (!data || !task || !milestone) {
    return (
      <div className="p-6">
        <p className="text-gray-500 text-sm">Task not found: {taskId}</p>
      </div>
    )
  }

  const hoursDisplay = task.actual_hours != null
    ? `Est: ${task.estimated_hours}h | Actual: ${task.actual_hours}h`
    : `${task.estimated_hours}h`

  const fields = [
    { label: 'Est', value: hoursDisplay },
    ...(task.started ? [{ label: 'Started', value: task.started }] : []),
    ...(task.completed_date ? [{ label: 'Completed', value: task.completed_date }] : []),
    {
      label: 'Milestone',
      value: (
        <Link
          to="/milestones/$milestoneId"
          params={{ milestoneId: milestone.id }}
          className="text-blue-400 hover:underline"
        >
          {milestone.id.replace('milestone_', 'M')} — {milestone.name}
        </Link>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-4xl">
      <Breadcrumb
        items={[
          { label: 'Milestones', href: '/milestones' },
          { label: `${milestone.id.replace('milestone_', 'M')} — ${milestone.name}`, href: `/milestones/${milestone.id}` },
          { label: task.name },
        ]}
      />

      <h1 className="text-xl font-semibold text-gray-100 mb-3">{task.name}</h1>

      <div className="flex items-center gap-2 mb-4">
        <PriorityBadge priority={task.priority} />
      </div>

      <DetailHeader status={task.status} fields={fields} />

      {task.notes && (
        <p className="text-sm text-gray-400 mb-6">{task.notes}</p>
      )}

      {/* Markdown content */}
      {loading ? (
        <p className="text-sm text-gray-600">Loading document...</p>
      ) : markdown ? (
        <MarkdownContent content={markdown} basePath={taskFilePath ?? undefined} linkMap={linkMap} />
      ) : markdownError ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
          No document found — {markdownError}
        </div>
      ) : null}

      {/* Prev / Next navigation */}
      {(siblings.prev || siblings.next) && (
        <div className="mt-8 flex items-center justify-between border-t border-gray-800 pt-4">
          {siblings.prev ? (
            <Link
              to="/tasks/$taskId"
              params={{ taskId: siblings.prev.id }}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              ← {siblings.prev.name}
            </Link>
          ) : (
            <span />
          )}
          {siblings.next ? (
            <Link
              to="/tasks/$taskId"
              params={{ taskId: siblings.next.id }}
              className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              {siblings.next.name} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  )
}
