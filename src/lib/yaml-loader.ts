import yaml from 'js-yaml'
import type {
  ProgressData,
  ProjectMetadata,
  Milestone,
  Task,
  WorkEntry,
  DocumentationStats,
  ProgressSummary,
  Status,
  Priority,
  ExtraFields,
} from './types'

// --- Key alias maps for agent drift ---

const PROJECT_ALIASES: Record<string, string> = {
  project_name: 'name',
  title: 'name',
}

const MILESTONE_ALIASES: Record<string, string> = {
  title: 'name',
  est_weeks: 'estimated_weeks',
  weeks: 'estimated_weeks',
  tasks_done: 'tasks_completed',
  total_tasks: 'tasks_total',
}

const TASK_ALIASES: Record<string, string> = {
  title: 'name',
  est_hours: 'estimated_hours',
  hours: 'estimated_hours',
  estimate: 'estimated_hours',
  completed: 'completed_date',
  done_date: 'completed_date',
  filename: 'file',
  path: 'file',
  document: 'file',
  milestone: 'milestone_id',
}

// --- Core helpers ---

function normalizeStatus(value: unknown): Status {
  const s = String(value || 'not_started')
    .toLowerCase()
    .replace(/[\s-]/g, '_')
  if (s === 'completed' || s === 'done' || s === 'complete') return 'completed'
  if (s === 'in_progress' || s === 'active' || s === 'wip' || s === 'started') return 'in_progress'
  if (s === 'wont_do' || s === 'won_t_do' || s === 'skipped' || s === 'cancelled' || s === 'canceled') return 'wont_do'
  return 'not_started'
}

function normalizePriority(value: unknown): Priority {
  const s = String(value || 'medium').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'low') return 'low'
  return 'medium'
}

function safeString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

function safeNumber(value: unknown, fallback = 0): number {
  // Strip trailing '%' (e.g. "100%" → "100") before parsing
  const cleaned = typeof value === 'string' ? value.replace(/%$/, '') : value
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : fallback
}

function normalizeStringArray(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value.map(String)
}

function resolveAliases(
  obj: Record<string, unknown>,
  aliases: Record<string, string>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const canonical = aliases[key] || key
    // Don't overwrite if canonical already set
    if (!(canonical in resolved)) {
      resolved[canonical] = value
    }
  }
  return resolved
}

function extractKnown(
  obj: Record<string, unknown>,
  knownKeys: string[],
): { known: Record<string, unknown>; extra: ExtraFields } {
  const known: Record<string, unknown> = {}
  const extra: ExtraFields = {}
  for (const [key, value] of Object.entries(obj)) {
    if (knownKeys.includes(key)) {
      known[key] = value
    } else {
      extra[key] = value
    }
  }
  return { known, extra }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

// --- Entity normalizers ---

const PROJECT_KEYS = ['name', 'version', 'started', 'status', 'current_milestone', 'description']

function normalizeProject(raw: unknown): ProjectMetadata {
  const obj = resolveAliases(asRecord(raw), PROJECT_ALIASES)
  const { known, extra } = extractKnown(obj, PROJECT_KEYS)
  return {
    name: safeString(known.name, 'Untitled Project'),
    version: safeString(known.version, '0.0.0'),
    started: safeString(known.started),
    status: normalizeStatus(known.status),
    current_milestone: known.current_milestone ? safeString(known.current_milestone) : undefined,
    description: safeString(known.description),
    extra,
  }
}

const MILESTONE_KEYS = [
  'id', 'name', 'priority', 'file', 'status', 'progress', 'started', 'completed',
  'estimated_weeks', 'tasks_completed', 'tasks_total', 'notes',
]

function normalizeMilestone(raw: unknown, index: number): Milestone {
  const obj = resolveAliases(asRecord(raw), MILESTONE_ALIASES)
  const { known, extra } = extractKnown(obj, MILESTONE_KEYS)
  return {
    id: safeString(known.id, `milestone_${index + 1}`),
    name: safeString(known.name, `Milestone ${index + 1}`),
    priority: normalizePriority(known.priority),
    file: safeString(known.file),
    status: normalizeStatus(known.status),
    progress: known.progress != null
      ? safeNumber(known.progress)
      : safeNumber(known.tasks_total) > 0
        ? Math.round((safeNumber(known.tasks_completed) / safeNumber(known.tasks_total)) * 100)
        : normalizeStatus(known.status) === 'completed' ? 100 : 0,
    started: known.started ? safeString(known.started) : null,
    completed: known.completed ? safeString(known.completed) : null,
    estimated_weeks: safeString(known.estimated_weeks, '0'),
    tasks_completed: safeNumber(known.tasks_completed),
    tasks_total: safeNumber(known.tasks_total),
    notes: safeString(known.notes),
    extra,
  }
}

function normalizeMilestones(raw: unknown): Milestone[] {
  // v6 format: milestones is a map keyed by ID (e.g. { M1: {...}, M2: {...} })
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    return Object.entries(obj).map(([key, value], i) => {
      const m = normalizeMilestone(value, i)
      // The map key IS the milestone ID — override whatever was parsed
      return { ...m, id: key }
    })
  }
  // Pre-v6 format: milestones is an array
  if (Array.isArray(raw)) {
    return raw.map((item, i) => normalizeMilestone(item, i))
  }
  return []
}

const TASK_KEYS = [
  'id', 'name', 'priority', 'status', 'milestone_id', 'file',
  'estimated_hours', 'actual_hours', 'started', 'completed_date', 'notes',
]

function normalizeTask(raw: unknown, milestoneId: string, index: number): Task {
  const obj = resolveAliases(asRecord(raw), TASK_ALIASES)
  const { known, extra } = extractKnown(obj, TASK_KEYS)
  return {
    id: safeString(known.id, `task_${index + 1}`),
    name: safeString(known.name, `Task ${index + 1}`),
    priority: normalizePriority(known.priority),
    status: normalizeStatus(known.status),
    milestone_id: safeString(known.milestone_id, milestoneId),
    file: safeString(known.file),
    estimated_hours: safeString(known.estimated_hours, '0'),
    actual_hours: known.actual_hours != null ? safeNumber(known.actual_hours) : null,
    started: known.started ? safeString(known.started) : null,
    completed_date: known.completed_date ? safeString(known.completed_date) : null,
    notes: safeString(known.notes),
    extra,
  }
}

function normalizeTasks(raw: unknown, milestones: Milestone[]): Record<string, Task[]> {
  const result: Record<string, Task[]> = {}
  const obj = asRecord(raw)

  // Build a map from task key patterns to milestone IDs.
  // Handles mismatch: tasks keyed as "milestone_1" but milestone.id = "M1"
  const keyToMilestoneId = new Map<string, string>()
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i]
    // The task key might be the milestone ID itself, or "milestone_N"
    keyToMilestoneId.set(m.id, m.id)
    keyToMilestoneId.set(m.id.toLowerCase(), m.id)
    // Map "milestone_N" where N matches the numeric part of the milestone ID (e.g. M1 → milestone_1)
    // NOTE: Do NOT use array index (i+1) here — milestones may be out of order in the YAML,
    // so array position does not reliably correspond to milestone number.
    const numMatch = m.id.match(/(\d+)/)
    if (numMatch) {
      keyToMilestoneId.set(`milestone_${numMatch[1]}`, m.id)
    }
  }

  for (const [rawKey, tasks] of Object.entries(obj)) {
    if (Array.isArray(tasks)) {
      // Resolve the key to a milestone ID, or keep as-is
      const milestoneId = keyToMilestoneId.get(rawKey) || rawKey
      const existing = result[milestoneId] || []
      result[milestoneId] = [
        ...existing,
        ...tasks.map((t, i) => normalizeTask(t, milestoneId, existing.length + i)),
      ]
    }
  }
  return result
}

function normalizeWorkEntry(raw: unknown): WorkEntry {
  const obj = asRecord(raw)
  const knownKeys = ['date', 'description', 'items']
  const { known, extra } = extractKnown(obj, knownKeys)
  return {
    date: safeString(known.date),
    description: safeString(known.description),
    items: normalizeStringArray(known.items),
    extra,
  }
}

function normalizeWorkEntries(raw: unknown): WorkEntry[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeWorkEntry)
}

function normalizeDocStats(raw: unknown): DocumentationStats {
  const obj = asRecord(raw)
  return {
    design_documents: safeNumber(obj.design_documents),
    milestone_documents: safeNumber(obj.milestone_documents),
    pattern_documents: safeNumber(obj.pattern_documents),
    task_documents: safeNumber(obj.task_documents),
  }
}

function normalizeProgress(raw: unknown): ProgressSummary {
  const obj = asRecord(raw)
  return {
    planning: safeNumber(obj.planning),
    implementation: safeNumber(obj.implementation),
    overall: safeNumber(obj.overall),
  }
}

// --- Main parser ---

const EMPTY_PROGRESS_DATA: ProgressData = {
  project: {
    name: 'Unknown',
    version: '0.0.0',
    started: '',
    status: 'not_started',
    description: '',
    extra: {},
  },
  milestones: [],
  tasks: {},
  recent_work: [],
  next_steps: [],
  notes: [],
  current_blockers: [],
  documentation: { design_documents: 0, milestone_documents: 0, pattern_documents: 0, task_documents: 0 },
  progress: { planning: 0, implementation: 0, overall: 0 },
}

// --- Inline milestone extraction ---
// Some progress.yaml files use top-level keys like `milestone_1_firebase_analytics:`
// containing milestone metadata + inline `tasks:` arrays.

const INLINE_MILESTONE_PATTERN = /^milestone_(\d+)_/

function extractInlineMilestones(d: Record<string, unknown>): {
  milestones: Milestone[]
  tasks: Record<string, Task[]>
} {
  const milestones: Milestone[] = []
  const tasks: Record<string, Task[]> = {}

  for (const [key, value] of Object.entries(d)) {
    const match = key.match(INLINE_MILESTONE_PATTERN)
    if (!match) continue
    const obj = asRecord(value)
    // Extract milestone ID from the name field (e.g. "M1 - ...") or synthesize from key
    const nameStr = safeString(obj.name)
    const idFromName = nameStr.match(/^(M\d+)\b/)?.[1]
    const milestoneId = idFromName || `M${match[1]}`

    const milestone = normalizeMilestone(
      { ...obj, id: milestoneId },
      milestones.length,
    )
    milestones.push(milestone)

    // Extract inline tasks if present
    if (Array.isArray(obj.tasks)) {
      tasks[milestoneId] = obj.tasks.map((t, i) =>
        normalizeTask(t, milestoneId, i),
      )
    }
  }

  return { milestones, tasks }
}

// --- Standalone / unassigned task extraction ---

function extractLooseTasks(
  d: Record<string, unknown>,
  keys: string[],
): Task[] {
  const result: Task[] = []
  for (const key of keys) {
    const arr = d[key]
    if (Array.isArray(arr)) {
      result.push(
        ...arr.map((t, i) => normalizeTask(t, '_unassigned', result.length + i)),
      )
    }
  }
  return result
}

// --- next_steps from multiple sources ---

function collectNextSteps(d: Record<string, unknown>): string[] {
  const steps = normalizeStringArray(d.next_steps)
  // next_immediate_steps may be a structured object with sub-keys or an array
  const immediate = d.next_immediate_steps
  if (immediate) {
    if (Array.isArray(immediate)) {
      steps.push(...immediate.map(String))
    } else if (typeof immediate === 'object' && immediate !== null) {
      // Structured object like { ready_to_implement: [...], security: [...] }
      for (const arr of Object.values(immediate)) {
        if (Array.isArray(arr)) {
          steps.push(...arr.map(String))
        }
      }
    }
  }
  return steps
}

export function parseProgressYaml(raw: string): ProgressData {
  try {
    // json: true allows duplicated keys (last wins) — common in agent-maintained YAML
    const doc = yaml.load(raw, { json: true })
    if (!doc || typeof doc !== 'object') {
      return { ...EMPTY_PROGRESS_DATA }
    }
    const d = doc as Record<string, unknown>

    // Standard milestones array
    const standardMilestones = normalizeMilestones(d.milestones)

    // Inline milestone_N_* top-level keys
    const inline = extractInlineMilestones(d)

    // Merge: inline milestones first (they tend to be older/lower-numbered),
    // then standard milestones. Deduplicate by ID (standard wins).
    const seenIds = new Set<string>()
    const allMilestones: Milestone[] = []
    for (const m of [...inline.milestones, ...standardMilestones]) {
      if (!seenIds.has(m.id)) {
        seenIds.add(m.id)
        allMilestones.push(m)
      }
    }

    // Standard tasks (from top-level `tasks:` key — last-wins with json: true)
    const standardTasks = normalizeTasks(d.tasks, allMilestones)

    // Merge inline tasks with standard tasks (standard wins on conflict)
    const allTasks: Record<string, Task[]> = { ...inline.tasks }
    for (const [key, tasks] of Object.entries(standardTasks)) {
      allTasks[key] = tasks // standard overwrites inline for same key
    }

    // Standalone and unassigned tasks
    const looseTasks = extractLooseTasks(d, ['standalone_tasks', 'unassigned_tasks'])
    if (looseTasks.length > 0) {
      const existing = allTasks['_unassigned'] || []
      allTasks['_unassigned'] = [...existing, ...looseTasks]
    }

    // Create synthetic milestones for any task keys without a matching milestone.
    // This handles `unassigned:` (or any other key) inside the `tasks:` object
    // that doesn't correspond to a declared milestone.
    for (const key of Object.keys(allTasks)) {
      if (!seenIds.has(key)) {
        seenIds.add(key)
        const tasks = allTasks[key]
        const isUnassigned = key === '_unassigned' || key.toLowerCase() === 'unassigned'
        const displayName = isUnassigned ? 'Unassigned Tasks' : key
        allMilestones.push({
          id: key,
          name: displayName,
          priority: 'medium',
          file: '',
          status: 'in_progress',
          progress: 0,
          started: null,
          completed: null,
          estimated_weeks: '0',
          tasks_completed: tasks.filter((t) => t.status === 'completed').length,
          tasks_total: tasks.length,
          notes: isUnassigned ? 'Tasks not assigned to a specific milestone' : `Tasks under "${key}"`,
          extra: { synthetic: true },
        })
      }
    }

    return {
      project: normalizeProject(d.project),
      milestones: allMilestones,
      tasks: allTasks,
      recent_work: normalizeWorkEntries(d.recent_work),
      next_steps: collectNextSteps(d),
      notes: normalizeStringArray(d.notes),
      current_blockers: normalizeStringArray(d.current_blockers),
      documentation: normalizeDocStats(d.documentation),
      progress: normalizeProgress(d.progress),
    }
  } catch {
    return { ...EMPTY_PROGRESS_DATA }
  }
}
