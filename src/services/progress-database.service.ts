import { createServerFn } from '@tanstack/react-start'
import type { ProgressData } from '../lib/types'

export type ProgressResult =
  | { ok: true; data: ProgressData }
  | { ok: false; error: 'FILE_NOT_FOUND' | 'PARSE_ERROR' | 'NO_FILESYSTEM'; message: string; path: string }

export const getProgressData = createServerFn({ method: 'GET' })
  .validator((input: { path?: string }) => input)
  .handler(async ({ data: input }): Promise<ProgressResult> => {
    try {
      const fs = await import('fs')
      const { parseProgressYaml } = await import('../lib/yaml-loader')
      const { getProgressYamlPath } = await import('../lib/config')

      const filePath = input.path || getProgressYamlPath()
      const raw = fs.readFileSync(filePath, 'utf-8')
      const data = parseProgressYaml(raw)
      return { ok: true, data }
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return { ok: false, error: 'FILE_NOT_FOUND', message: `progress.yaml not found`, path: input.path || '' }
      }
      // Cloudflare Workers: fs module exists but readFileSync throws
      return { ok: false, error: 'NO_FILESYSTEM', message: 'No local filesystem — use GitHub input to load a project', path: '' }
    }
  })
