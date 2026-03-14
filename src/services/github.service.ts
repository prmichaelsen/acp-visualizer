import { createServerFn } from '@tanstack/react-start'
import type { ProgressData } from '../lib/types'

export type GitHubResult =
  | { ok: true; data: ProgressData }
  | { ok: false; error: string; message: string }

export const fetchGitHubProgress = createServerFn({ method: 'GET' })
  .inputValidator((input: { owner: string; repo: string; branch?: string; token?: string }) => input)
  .handler(async ({ data: input }): Promise<GitHubResult> => {
    const { parseProgressYaml } = await import('../lib/yaml-loader')

    let branch = input.branch
    if (!branch) {
      // Detect default branch from GitHub API (not always 'main')
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${input.owner}/${input.repo}`, {
          headers: input.token ? { Authorization: `token ${input.token}` } : {},
        })
        if (metaRes.ok) {
          const meta = await metaRes.json() as { default_branch?: string }
          branch = meta.default_branch || 'main'
        } else {
          branch = 'main'
        }
      } catch {
        branch = 'main'
      }
    }
    const url = `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${branch}/agent/progress.yaml`

    try {
      const headers: Record<string, string> = {
        'Accept': 'text/plain',
      }
      if (input.token) {
        headers['Authorization'] = `token ${input.token}`
      }

      const response = await fetch(url, { headers })

      if (!response.ok) {
        if (response.status === 404) {
          return {
            ok: false,
            error: 'NOT_FOUND',
            message: `No progress.yaml found at ${input.owner}/${input.repo} (branch: ${branch})`,
          }
        }
        return {
          ok: false,
          error: 'FETCH_ERROR',
          message: `GitHub returned ${response.status}: ${response.statusText}`,
        }
      }

      const raw = await response.text()
      const data = parseProgressYaml(raw)
      return { ok: true, data }
    } catch (err) {
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to fetch from GitHub',
      }
    }
  })
