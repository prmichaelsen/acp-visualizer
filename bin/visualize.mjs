#!/usr/bin/env node

import { resolve, dirname } from 'path'
import { existsSync, cpSync, mkdirSync, rmSync } from 'fs'
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

// Strategy: copy source files into the node_modules root where deps
// are hoisted. This gives vite a project root with node_modules as a
// direct child, so ESM resolution works correctly for TanStack Start's
// virtual modules.

function findNodeModulesRoot() {
  let dir = packageRoot
  while (dir !== '/') {
    const candidate = resolve(dir, 'node_modules')
    if (existsSync(resolve(candidate, '.bin', 'vite'))) return dir
    dir = resolve(dir, '..')
  }
  return packageRoot
}

const nmRoot = findNodeModulesRoot()
const workDir = resolve(nmRoot, '.acp-visualizer-app')

// Copy source files into workDir (small — ~60KB)
rmSync(workDir, { recursive: true, force: true })
mkdirSync(workDir, { recursive: true })
cpSync(resolve(packageRoot, 'src'), resolve(workDir, 'src'), { recursive: true })
cpSync(resolve(packageRoot, 'vite.config.ts'), resolve(workDir, 'vite.config.ts'))
cpSync(resolve(packageRoot, 'tsconfig.json'), resolve(workDir, 'tsconfig.json'))
cpSync(resolve(packageRoot, 'package.json'), resolve(workDir, 'package.json'))

// Symlink the existing node_modules into the workdir
// (they're one level up, so ../node_modules)
const existingNM = resolve(nmRoot, 'node_modules')
const targetNM = resolve(workDir, 'node_modules')
if (!existsSync(targetNM)) {
  const { symlinkSync } = await import('fs')
  symlinkSync(existingNM, targetNM)
}

function cleanup() {
  try { rmSync(workDir, { recursive: true, force: true }) } catch { /* best effort */ }
}
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(130) })
process.on('SIGTERM', () => { cleanup(); process.exit(143) })

console.log(`\n  ACP Progress Visualizer`)
console.log(`  Loading: ${progressPath}`)
console.log(`  Port:    ${port}\n`)

const viteBin = resolve(workDir, 'node_modules', '.bin', 'vite')

const child = spawn(viteBin, ['dev', '--port', port, '--host'], {
  cwd: workDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PROGRESS_YAML_PATH: progressPath,
  },
})

child.on('error', (err) => {
  console.error('Failed to start dev server:', err.message)
  cleanup()
  process.exit(1)
})

child.on('exit', (code) => {
  cleanup()
  process.exit(code ?? 0)
})
