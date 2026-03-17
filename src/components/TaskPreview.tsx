import { Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useProgressData } from '../contexts/ProgressContext'
import { DetailHeader } from './DetailHeader'
import { PriorityBadge } from './PriorityBadge'
import { MarkdownContent, buildLinkMap } from './MarkdownContent'
import { getMarkdownContent, resolveTaskFile } from '../services/markdown.service'
import type { MarkdownResult } from '../services/markdown.service'

interface TaskPreviewProps {
  taskId: string
}

function getGitHubParams(): { owner: string; repo: string } | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const repo = params.get('repo')
  if (!repo) return undefined
  const parts = repo.split('/')
  if (parts.length < 2) return undefined
  return { owner: parts[0], repo: parts[1] }
}

export function TaskPreview({ taskId }: TaskPreviewProps) {
  const data = useProgressData()
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const { task, milestone } = useMemo(() => {
    if (!data) return { task: null, milestone: null }

    for (const ms of data.milestones) {
      const msTaskList = data.tasks[ms.id] || []
      const foundTask = msTaskList.find((t) => t.id === taskId)
      if (foundTask) {
        return { task: foundTask, milestone: ms }
      }
    }
    return { task: null, milestone: null }
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
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Task not found: {taskId}</p>
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
          className="text-blue-500 dark:text-blue-400 hover:underline"
        >
          {milestone.id.replace('milestone_', 'M')} — {milestone.name}
        </Link>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{task.name}</h1>
        <Link
          to="/tasks/$taskId"
          params={{ taskId }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Open full view"
        >
          <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <PriorityBadge priority={task.priority} />
      </div>

      <DetailHeader status={task.status} fields={fields} />

      {task.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{task.notes}</p>
      )}

      {/* Markdown content */}
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-500">Loading document...</p>
      ) : markdown ? (
        <div className="prose-sm">
          <MarkdownContent content={markdown} basePath={taskFilePath ?? undefined} linkMap={linkMap} />
        </div>
      ) : markdownError ? (
        <div className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-500">
          No document found — {markdownError}
        </div>
      ) : null}
    </div>
  )
}
