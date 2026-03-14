import { useState } from 'react'
import { Github, Loader2 } from 'lucide-react'

interface GitHubInputProps {
  onLoad: (owner: string, repo: string) => Promise<void>
}

export function GitHubInput({ onLoad }: GitHubInputProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    // Parse owner/repo from various formats
    const cleaned = value.trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '')

    const parts = cleaned.split('/')
    if (parts.length < 2) {
      setError('Enter owner/repo (e.g. user/project)')
      return
    }

    setLoading(true)
    try {
      await onLoad(parts[0], parts[1])
      setValue('')
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Github className="absolute left-2 top-[7px] w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="owner/repo"
            className="w-full bg-gray-900 border border-gray-800 rounded-md pl-7 pr-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
