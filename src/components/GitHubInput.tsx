import { useState, useEffect, useRef } from 'react'
import { Github, Loader2 } from 'lucide-react'
import { getStoredToken } from '../lib/github-auth'
import { searchGitHubRepos } from '../services/github-oauth.service'

interface GitHubInputProps {
  onLoad: (owner: string, repo: string) => Promise<void>
}

interface RepoSuggestion {
  full_name: string
  description: string | null
  private: boolean
}

export function GitHubInput({ onLoad }: GitHubInputProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<RepoSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const inputRef = useRef<HTMLDivElement>(null)

  const token = getStoredToken()

  // Update dropdown position when shown
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [showSuggestions])

  // Search for repos when user types (authenticated only)
  useEffect(() => {
    if (!token || !value.trim() || value.includes('/')) {
      setSuggestions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const result = await searchGitHubRepos({ data: { token, query: value } })
        if (result.ok) {
          setSuggestions(result.repos)
          setShowSuggestions(true)
        }
      } catch {
        // Silently fail - not critical
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [value, token])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (repoFullName?: string) => {
    setError(null)
    setShowSuggestions(false)

    const input = repoFullName || value.trim()

    // Parse owner/repo from various formats
    const cleaned = input
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
      setSuggestions([])
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={inputRef} className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <Github className="absolute left-2 top-2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit()
              } else if (e.key === 'Escape') {
                setShowSuggestions(false)
              }
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={token ? "Search your repos..." : "owner/repo"}
            className="w-full bg-gray-900 border border-gray-800 rounded-md pl-8 pr-2 py-2 text-base text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors"
          />
          {searchLoading && (
            <Loader2 className="absolute right-2 top-2 w-4 h-4 text-gray-500 animate-spin" />
          )}
        </div>
        <button
          onClick={() => handleSubmit()}
          disabled={loading || !value.trim()}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
        </button>
      </div>

      {/* Suggestions dropdown - using fixed positioning to avoid clipping */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          className="fixed z-[100] bg-gray-900 border border-gray-800 rounded-md shadow-lg max-h-60 overflow-y-auto"
          style={{
            top: `${dropdownStyle.top}px`,
            left: `${dropdownStyle.left}px`,
            width: `${dropdownStyle.width}px`,
          }}
        >
          {suggestions.map((repo) => (
            <button
              key={repo.full_name}
              onClick={() => handleSubmit(repo.full_name)}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-200 font-medium">{repo.full_name}</span>
                {repo.private && (
                  <span className="text-xs px-1.5 py-0.5 bg-yellow-900/30 text-yellow-500 rounded">Private</span>
                )}
              </div>
              {repo.description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">{repo.description}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
