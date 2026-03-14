#!/usr/bin/env node

import { resolve, dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(__dirname, '..')

// Parse args
const args = process.argv.slice(2)
let progressPath = null
let port = '3400'

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' || args[i] === '-p') {
    port = args[++i]
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
  ACP Progress Visualizer

  Usage:
    npx @prmichaelsen/acp-visualizer [options] [path]

  Arguments:
    path                  Path to progress.yaml (default: ./agent/progress.yaml)

  Options:
    -p, --port <port>     Port to run on (default: 3400)
    -h, --help            Show this help message

  Examples:
    npx @prmichaelsen/acp-visualizer
    npx @prmichaelsen/acp-visualizer ./agent/progress.yaml
    npx @prmichaelsen/acp-visualizer --port 4000
    npx @prmichaelsen/acp-visualizer /path/to/other/progress.yaml
`)
    process.exit(0)
  } else if (!args[i].startsWith('-')) {
    progressPath = args[i]
  }
}

// Resolve progress.yaml path
if (!progressPath) {
  progressPath = resolve(process.cwd(), 'agent/progress.yaml')
} else {
  progressPath = resolve(process.cwd(), progressPath)
}

if (!existsSync(progressPath)) {
  console.error(`\n  Error: progress.yaml not found at: ${progressPath}\n`)
  console.error(`  Make sure you're in an ACP project directory, or pass the path explicitly:\n`)
  console.error(`    npx @prmichaelsen/acp-visualizer /path/to/agent/progress.yaml\n`)
  process.exit(1)
}

console.log(`\n  ACP Progress Visualizer`)
console.log(`  Loading: ${progressPath}`)
console.log(`  Port:    ${port}\n`)

// Start vite dev server from the package directory
const child = spawn('npx', ['vite', 'dev', '--port', port, '--host'], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    PROGRESS_YAML_PATH: progressPath,
  },
})

child.on('error', (err) => {
  console.error('Failed to start dev server:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

// Forward signals for clean shutdown
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
