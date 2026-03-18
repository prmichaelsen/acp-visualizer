import { createServerFn } from '@tanstack/react-start'

export type MarkdownResult =
  | { ok: true; content: string; filePath: string }
  | { ok: false; content: null; error: string }

export type ResolveFileResult =
  | { ok: true; filePath: string }
  | { ok: false; filePath: null; error: string }

/**
 * Derives the project base path from PROGRESS_YAML_PATH.
 * e.g. "/home/user/project/agent/progress.yaml" → "/home/user/project"
 */
function getBasePath(): string {
  const progressPath = process.env.PROGRESS_YAML_PATH || './agent/progress.yaml'
  // Strip "agent/progress.yaml" (or similar trailing segment) to get project root
  return progressPath.replace(/\/agent\/progress\.yaml$/, '') || '.'
}

// ---------- getMarkdownContent ----------

export const getMarkdownContent = createServerFn({ method: 'GET' })
  .inputValidator((input: { filePath: string; github?: { owner: string; repo: string; branch?: string; token?: string } }) => input)
  .handler(async ({ data: input }): Promise<MarkdownResult> => {
    // GitHub mode
    if (input.github) {
      return fetchMarkdownFromGitHub(input.filePath, input.github)
    }

    // Local mode
    return readMarkdownFromDisk(input.filePath)
  })

async function readMarkdownFromDisk(relativePath: string): Promise<MarkdownResult> {
  try {
    const fs = await import('fs')
    const path = await import('path')

    const basePath = getBasePath()
    const fullPath = path.resolve(basePath, relativePath)

    if (!fs.existsSync(fullPath)) {
      return { ok: false, content: null, error: `File not found: ${relativePath}` }
    }

    const content = fs.readFileSync(fullPath, 'utf-8')
    return { ok: true, content, filePath: relativePath }
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return { ok: false, content: null, error: `File not found: ${relativePath}` }
    }
    if (err?.code === 'EACCES') {
      return { ok: false, content: null, error: `Permission denied: ${relativePath}` }
    }
    return { ok: false, content: null, error: `Failed to read file: ${relativePath}` }
  }
}

async function fetchMarkdownFromGitHub(
  filePath: string,
  github: { owner: string; repo: string; branch?: string; token?: string },
): Promise<MarkdownResult> {
  try {
    let branch = github.branch
    if (!branch) {
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}`, {
          headers: github.token ? { Authorization: `token ${github.token}` } : {},
        })
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { default_branch?: string }
          branch = meta.default_branch || 'main'
        } else {
          branch = 'main'
        }
      } catch {
        branch = 'main'
      }
    }

    const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${filePath}?ref=${branch}`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    }
    if (github.token) {
      headers['Authorization'] = `token ${github.token}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, content: null, error: `File not found: ${filePath}` }
      }
      if (response.status === 403) {
        return { ok: false, content: null, error: `GitHub rate limit or permission denied for: ${filePath}` }
      }
      return { ok: false, content: null, error: `GitHub returned ${response.status}: ${response.statusText}` }
    }

    const json = (await response.json()) as { content?: string; encoding?: string }
    if (!json.content) {
      return { ok: false, content: null, error: `No content returned for: ${filePath}` }
    }

    const content = Buffer.from(json.content, 'base64').toString('utf-8')
    return { ok: true, content, filePath }
  } catch (err) {
    return {
      ok: false,
      content: null,
      error: err instanceof Error ? err.message : `Failed to fetch from GitHub: ${filePath}`,
    }
  }
}

// ---------- listAgentDirectory ----------

export type AgentFile = {
  name: string
  /** Relative path from project root, e.g. "agent/design/local.foo.md" */
  relativePath: string
}

export type ListDirResult =
  | { ok: true; files: AgentFile[]; directoryExists?: boolean }
  | { ok: false; files: []; error: string }

export const listAgentDirectory = createServerFn({ method: 'GET' })
  .inputValidator((input: { dirPath: string; github?: { owner: string; repo: string; branch?: string; token?: string } }) => input)
  .handler(async ({ data: input }): Promise<ListDirResult> => {
    if (input.github) {
      return listDirFromGitHub(input.dirPath, input.github)
    }
    return listDirFromDisk(input.dirPath)
  })

async function listDirFromDisk(dirPath: string): Promise<ListDirResult> {
  try {
    const fs = await import('fs')
    const path = await import('path')

    const basePath = getBasePath()
    const fullDir = path.resolve(basePath, dirPath)

    if (!fs.existsSync(fullDir)) {
      return { ok: false, files: [], error: `Directory not found: ${dirPath}` }
    }

    const entries = fs.readdirSync(fullDir)
    const files: AgentFile[] = entries
      .filter((f: string) => f.endsWith('.md') && !f.includes('template'))
      .sort()
      .map((f: string) => ({
        name: f.replace(/\.md$/, ''),
        relativePath: `${dirPath}/${f}`,
      }))

    return { ok: true, files }
  } catch (err: any) {
    return { ok: false, files: [], error: `Failed to list directory: ${dirPath}` }
  }
}

async function listDirFromGitHub(
  dirPath: string,
  github: { owner: string; repo: string; branch?: string; token?: string },
): Promise<ListDirResult> {
  try {
    let branch = github.branch
    if (!branch) {
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}`, {
          headers: github.token ? { Authorization: `token ${github.token}` } : {},
        })
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { default_branch?: string }
          branch = meta.default_branch || 'main'
        } else {
          branch = 'main'
        }
      } catch {
        branch = 'main'
      }
    }

    const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${dirPath}?ref=${branch}`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    }
    if (github.token) {
      headers['Authorization'] = `token ${github.token}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: true, files: [], directoryExists: false }
      }
      return { ok: false, files: [], error: `GitHub returned ${response.status}` }
    }

    const entries = (await response.json()) as Array<{ name: string; path: string; type: string }>
    const files: AgentFile[] = entries
      .filter((e) => e.name.endsWith('.md') && !e.name.includes('template'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.name.replace(/\.md$/, ''),
        relativePath: e.path,
      }))

    return { ok: true, files }
  } catch (err) {
    return { ok: false, files: [], error: `Failed to list directory from GitHub` }
  }
}

// ---------- resolveMilestoneFile ----------

export const resolveMilestoneFile = createServerFn({ method: 'GET' })
  .inputValidator((input: { milestoneId: string; github?: { owner: string; repo: string; branch?: string; token?: string } }) => input)
  .handler(async ({ data: input }): Promise<ResolveFileResult> => {
    // Extract numeric part: "milestone_1" → "1", "M2" → "2", any string with digits
    const match = input.milestoneId.match(/milestone_(\d+)/) || input.milestoneId.match(/^M(\d+)$/i) || input.milestoneId.match(/(\d+)/)
    if (!match) {
      return { ok: false, filePath: null, error: `Invalid milestone id format: ${input.milestoneId}` }
    }
    const num = match[1]
    const dirPath = 'agent/milestones'

    if (input.github) {
      return resolveMilestoneFromGitHub(num, dirPath, input.github)
    }

    return resolveMilestoneFromDisk(num, dirPath)
  })

async function resolveMilestoneFromDisk(num: string, dirPath: string): Promise<ResolveFileResult> {
  try {
    const fs = await import('fs')
    const path = await import('path')

    const basePath = getBasePath()
    const fullDir = path.resolve(basePath, dirPath)

    if (!fs.existsSync(fullDir)) {
      return { ok: false, filePath: null, error: `Milestones directory not found: ${dirPath}` }
    }

    const files = fs.readdirSync(fullDir)
    const matched = files.find(
      (f: string) => f.startsWith(`milestone-${num}-`) && f.endsWith('.md') && !f.includes('template'),
    )

    if (!matched) {
      return { ok: false, filePath: null, error: `No milestone file found for milestone_${num}` }
    }

    return { ok: true, filePath: `${dirPath}/${matched}` }
  } catch (err: any) {
    if (err?.code === 'EACCES') {
      return { ok: false, filePath: null, error: `Permission denied: ${dirPath}` }
    }
    return { ok: false, filePath: null, error: `Failed to scan milestones directory` }
  }
}

async function resolveMilestoneFromGitHub(
  num: string,
  dirPath: string,
  github: { owner: string; repo: string; branch?: string; token?: string },
): Promise<ResolveFileResult> {
  try {
    let branch = github.branch
    if (!branch) {
      try {
        const metaRes = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}`, {
          headers: github.token ? { Authorization: `token ${github.token}` } : {},
        })
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as { default_branch?: string }
          branch = meta.default_branch || 'main'
        } else {
          branch = 'main'
        }
      } catch {
        branch = 'main'
      }
    }

    const url = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${dirPath}?ref=${branch}`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    }
    if (github.token) {
      headers['Authorization'] = `token ${github.token}`
    }

    const response = await fetch(url, { headers })

    if (!response.ok) {
      if (response.status === 404) {
        return { ok: false, filePath: null, error: `Milestones directory not found on GitHub: ${dirPath}` }
      }
      if (response.status === 403) {
        return { ok: false, filePath: null, error: `GitHub rate limit or permission denied` }
      }
      return { ok: false, filePath: null, error: `GitHub returned ${response.status}: ${response.statusText}` }
    }

    const entries = (await response.json()) as Array<{ name: string; path: string; type: string }>
    const matched = entries.find(
      (e) => e.name.startsWith(`milestone-${num}-`) && e.name.endsWith('.md') && !e.name.includes('template'),
    )

    if (!matched) {
      return { ok: false, filePath: null, error: `No milestone file found for milestone_${num}` }
    }

    return { ok: true, filePath: matched.path }
  } catch (err) {
    return {
      ok: false,
      filePath: null,
      error: err instanceof Error ? err.message : `Failed to list milestones from GitHub`,
    }
  }
}

// ---------- resolveTaskFile ----------

/**
 * Resolves the markdown file path for a task.
 * This is a plain function (not a server function) since task data
 * including the `file` field is already available client-side.
 */
export function resolveTaskFile(task: { file?: string } | null | undefined): string | null {
  return task?.file || null
}
