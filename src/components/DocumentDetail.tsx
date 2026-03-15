import { useState, useEffect, useMemo } from 'react'
import { Breadcrumb } from './Breadcrumb'
import { MarkdownContent, buildLinkMap } from './MarkdownContent'
import { getMarkdownContent, listAgentDirectory } from '../services/markdown.service'
import { useProgressData } from '../contexts/ProgressContext'
import type { MarkdownResult, AgentFile } from '../services/markdown.service'

interface DocumentDetailProps {
  slug: string
  dirPath: string
  sectionLabel: string
  sectionHref: string
}

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

export function DocumentDetail({ slug, dirPath, sectionLabel, sectionHref }: DocumentDetailProps) {
  const data = useProgressData()
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filePath, setFilePath] = useState<string | null>(null)
  const linkMap = useMemo(() => (data ? buildLinkMap(data) : {}), [data])

  useEffect(() => {
    setLoading(true)
    setMarkdown(null)
    setError(null)

    const github = getGitHubParams()
    const relativePath = `${dirPath}/${slug}.md`

    // Try the direct path first, fallback to directory listing if needed
    getMarkdownContent({ data: { filePath: relativePath, github } })
      .then((result: MarkdownResult) => {
        if (result.ok) {
          setMarkdown(result.content)
          setFilePath(result.filePath)
        } else {
          // Fallback: search directory for a file containing the slug
          return listAgentDirectory({ data: { dirPath, github } }).then((listResult) => {
            if (listResult.ok) {
              const match = listResult.files.find((f: AgentFile) => f.name === slug)
              if (match) {
                return getMarkdownContent({ data: { filePath: match.relativePath, github } })
                  .then((mdResult: MarkdownResult) => {
                    if (mdResult.ok) {
                      setMarkdown(mdResult.content)
                      setFilePath(mdResult.filePath)
                    } else {
                      setError(mdResult.error)
                    }
                  })
              }
            }
            setError(result.error)
          })
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug, dirPath])

  const displayName = slug
    .replace(/^[a-z0-9-]+\./, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="p-6 max-w-4xl">
      <Breadcrumb
        items={[
          { label: sectionLabel, href: sectionHref },
          { label: displayName },
        ]}
      />

      <h1 className="text-xl font-semibold text-gray-100 mb-6">{displayName}</h1>

      {loading ? (
        <p className="text-sm text-gray-600">Loading document...</p>
      ) : markdown ? (
        <MarkdownContent content={markdown} basePath={filePath ?? undefined} linkMap={linkMap} />
      ) : error ? (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
          No document found — {error}
        </div>
      ) : null}
    </div>
  )
}
