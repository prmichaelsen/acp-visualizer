/**
 * Resolves the path to progress.yaml from (in order):
 * 1. PROGRESS_YAML_PATH environment variable
 * 2. Default: ./agent/progress.yaml (relative to cwd)
 */
export function getProgressYamlPath(): string {
  return process.env.PROGRESS_YAML_PATH || './agent/progress.yaml'
}
