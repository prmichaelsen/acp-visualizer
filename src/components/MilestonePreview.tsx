import { Link } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { useProgressData } from '../contexts/ProgressContext'
import { DetailHeader } from './DetailHeader'
import { ProgressBar } from './ProgressBar'
import { StatusDot } from './StatusDot'
import { PriorityBadge } from './PriorityBadge'
import { MarkdownContent, buildLinkMap } from './MarkdownContent'
import { getMarkdownContent, resolveMilestoneFile } from '../services/markdown.service'
import type { MarkdownResult, ResolveFileResult } from '../services/markdown.service'

interface MilestonePreviewProps {
  milestoneId: string
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

export function MilestonePreview({ milestoneId }: MilestonePreviewProps) {
  const data = useProgressData()
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [markdownFilePath, setMarkdownFilePath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const milestone = data?.milestones.find((m) => m.id === milestoneId)
  const tasks = data?.tasks[milestoneId] || []
  const linkMap = useMemo(() => (data ? buildLinkMap(data) : {}), [data])

  useEffect(() => {
    if (!milestoneId) return

    setLoading(true)
    setMarkdown(null)
    setMarkdownError(null)
    setMarkdownFilePath(null)

    const github = getGitHubParams()

    resolveMilestoneFile({ data: { milestoneId, github } })
      .then((resolveResult: ResolveFileResult) => {
        if (!resolveResult.ok) {
          setMarkdownError(resolveResult.error)
          setLoading(false)
          return
        }

        setMarkdownFilePath(resolveResult.filePath)
        return getMarkdownContent({ data: { filePath: resolveResult.filePath, github } })
          .then((mdResult: MarkdownResult) => {
            if (mdResult.ok) {
              setMarkdown(mdResult.content)
            } else {
              setMarkdownError(mdResult.error)
            }
          })
      })
      .catch((err: Error) => {
        setMarkdownError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [milestoneId])

  if (!data || !milestone) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Milestone not found: {milestoneId}</p>
      </div>
    )
  }

  const fields = [
    ...(milestone.started ? [{ label: 'Started', value: milestone.started }] : []),
    ...(milestone.completed ? [{ label: 'Completed', value: milestone.completed }] : []),
    { label: 'Est', value: `${milestone.estimated_weeks} week${milestone.estimated_weeks === '1' ? '' : 's'}` },
    { label: 'Tasks', value: `${milestone.tasks_completed}/${milestone.tasks_total}` },
  ]

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{milestone.name}</h1>
        <Link
          to="/milestones/$milestoneId"
          params={{ milestoneId }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Open full view"
        >
          <ExternalLink className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 max-w-xs">
          <ProgressBar value={milestone.progress} size="sm" />
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-500">{milestone.progress}%</span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <PriorityBadge priority={milestone.priority} />
      </div>

      <DetailHeader status={milestone.status} fields={fields} />

      {milestone.notes && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{milestone.notes}</p>
      )}

      {/* Markdown content */}
      {loading ? (
        <p className="text-sm text-gray-600 dark:text-gray-500">Loading document...</p>
      ) : markdown ? (
        <div className="prose-sm">
          <MarkdownContent content={markdown} basePath={markdownFilePath ?? undefined} linkMap={linkMap} />
        </div>
      ) : markdownError ? (
        <div className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm text-gray-600 dark:text-gray-500">
          No document found — {markdownError}
        </div>
      ) : null}

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-400 uppercase tracking-wider mb-3">
            Tasks
          </h2>
          <div className="bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-800">
            {tasks.map((task) => (
              <Link
                key={task.id}
                to="/tasks/$taskId"
                params={{ taskId: task.id }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                <StatusDot status={task.status} />
                <span className={task.status === 'completed' ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-200'}>
                  {task.name}
                </span>
                <PriorityBadge priority={task.priority} />
                {task.estimated_hours && (
                  <span className="text-xs text-gray-600 dark:text-gray-600 ml-auto">{task.estimated_hours}h</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
