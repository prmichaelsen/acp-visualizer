import { readFileSync } from 'fs'
import { parseProgressYaml } from '../lib/yaml-loader'
import { getProgressYamlPath } from '../lib/config'
import type { ProgressData } from '../lib/types'

export type ProgressResult =
  | { ok: true; data: ProgressData }
  | { ok: false; error: 'FILE_NOT_FOUND' | 'PARSE_ERROR'; message: string; path: string }

export class ProgressDatabaseService {
  static getProgressData(): ProgressResult {
    const filePath = getProgressYamlPath()

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
  }
}
