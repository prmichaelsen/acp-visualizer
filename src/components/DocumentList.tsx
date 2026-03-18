import { Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAgentDirectory } from '../services/markdown.service'
import type { AgentFile } from '../services/markdown.service'
import { FileText } from 'lucide-react'

interface DocumentListProps {
  title: string
  dirPath: string
  baseTo: string
  github?: { owner: string; repo: string; branch?: string; token?: string }
}

export function DocumentList({ title, dirPath, baseTo, github }: DocumentListProps) {
  const [files, setFiles] = useState<AgentFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [directoryExists, setDirectoryExists] = useState(true)

  useEffect(() => {
    setLoading(true)
    setDirectoryExists(true)
    listAgentDirectory({ data: { dirPath, github } })
      .then((result) => {
        if (result.ok) {
          setFiles(result.files)
          setDirectoryExists(result.directoryExists !== false)
        } else {
          setError(result.error)
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [dirPath, github])

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-sm text-gray-500">
          {error}
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {!directoryExists && github ? (
          <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4">
            <p className="text-sm text-yellow-300 mb-2">
              Directory <code className="text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">{dirPath}/</code> not found in this repository.
            </p>
            <p className="text-xs text-yellow-400/80">
              This repository may not follow the standard ACP structure. You can create this directory and add .md files to populate this section.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No documents found in <code className="text-gray-400">{dirPath}/</code></p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl divide-y divide-gray-800">
        {files.map((file) => (
          <Link
            key={file.name}
            to={baseTo + '/$slug'}
            params={{ slug: file.name }}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-800/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <FileText className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-gray-200">{formatName(file.name)}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-3">{files.length} document{files.length !== 1 ? 's' : ''}</p>
    </div>
  )
}

/** Turn "local.dashboard-layout-routing" into "Dashboard Layout Routing" */
function formatName(name: string): string {
  // Strip common prefixes like "local." or "core-sdk."
  const stripped = name.replace(/^[a-z0-9-]+\./, '')
  return stripped
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
