import { createServerFn } from '@tanstack/react-start'
import type { ProgressData } from '../lib/types'

export type ProgressResult =
  | { ok: true; data: ProgressData }
  | { ok: false; error: 'FILE_NOT_FOUND' | 'PARSE_ERROR'; message: string; path: string }

export const getProgressData = createServerFn({ method: 'GET' })
  .validator((input: { path?: string }) => input)
  .handler(async ({ data: input }): Promise<ProgressResult> => {
    const { readFileSync } = await import('fs')
    const { parseProgressYaml } = await import('../lib/yaml-loader')
    const { getProgressYamlPath } = await import('../lib/config')

    const filePath = input.path || getProgressYamlPath()

    try {
      const raw = readFileSync(filePath, 'utf-8')

      try {
        const data = parseProgressYaml(raw)
        return { ok: true, data }
      } catch (err) {
        return {
          ok: false,
          error: 'PARSE_ERROR',
          message: err instanceof Error ? err.message : 'Failed to parse YAML',
          path: filePath,
        }
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return {
          ok: false,
          error: 'FILE_NOT_FOUND',
          message: `progress.yaml not found at: ${filePath}`,
          path: filePath,
        }
      }
      return {
        ok: false,
        error: 'PARSE_ERROR',
        message: err instanceof Error ? err.message : 'Failed to read file',
        path: filePath,
      }
    }
  })
