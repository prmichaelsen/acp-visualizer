import { createServerFn } from '@tanstack/react-start'

export interface AcpProject {
  id: string
  path: string
  type: string
  description: string
  status: string
  hasProgress: boolean
}

export const listProjects = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AcpProject[]> => {
    try {
      const { readFileSync, existsSync } = await import('fs')
      const { resolve } = await import('path')
      const { homedir } = await import('os')
      const yaml = await import('js-yaml')

      const projectsFile = resolve(homedir(), '.acp', 'projects.yaml')
      if (!existsSync(projectsFile)) return []

      const raw = readFileSync(projectsFile, 'utf-8')
      const doc = yaml.load(raw, { json: true }) as Record<string, unknown>
      const projects = (doc?.projects || {}) as Record<string, Record<string, unknown>>

      return Object.entries(projects).map(([id, p]) => {
        const projectPath = String(p.path || '')
        const progressPath = resolve(projectPath, 'agent', 'progress.yaml')
        return {
          id,
          path: projectPath,
          type: String(p.type || 'unknown'),
          description: String(p.description || ''),
          status: String(p.status || 'unknown'),
          hasProgress: existsSync(progressPath),
        }
      })
    } catch {
      // Cloudflare Workers: no filesystem
      return []
    }
  },
)

export const getProjectProgressPath = createServerFn({ method: 'GET' })
  .validator((input: { projectId: string }) => input)
  .handler(async ({ data }): Promise<string | null> => {
    try {
      const { readFileSync, existsSync } = await import('fs')
      const { resolve } = await import('path')
      const { homedir } = await import('os')
      const yaml = await import('js-yaml')

      const projectsFile = resolve(homedir(), '.acp', 'projects.yaml')
      if (!existsSync(projectsFile)) return null

      const raw = readFileSync(projectsFile, 'utf-8')
      const doc = yaml.load(raw, { json: true }) as Record<string, unknown>
      const projects = (doc?.projects || {}) as Record<string, Record<string, unknown>>
      const project = projects[data.projectId]
      if (!project) return null

      const progressPath = resolve(String(project.path), 'agent', 'progress.yaml')
      return existsSync(progressPath) ? progressPath : null
    } catch {
      return null
    }
  })
