# Task 15: Update Data Model and Parser for Map-Based Milestones

**Milestone**: [M4 - ACP 6.0.0 Compatibility Update](../../milestones/milestone-4-acp-6-compatibility.md)
**Design Reference**: [Visualizer Requirements](../../design/local.visualizer-requirements.md)
**Estimated Time**: 3-4 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Update `types.ts` and `yaml-loader.ts` to support ACP 6.0.0's map-based milestone format, normalized task keys, and new required fields (`priority`, `started`, `actual_hours`), while maintaining full backward compatibility with pre-6.0.0 array-based progress.yaml files.

---

## Context

ACP 6.0.0 (released 2026-03-16) introduced three breaking changes to progress.yaml:

1. **Milestones array -> map**: `milestones:` is now an object keyed by milestone ID (`M1:`, `M2:`) instead of an array with `- id: milestone_1`.
2. **Task keys normalized**: `tasks:` keys changed from `milestone_1` to `M1` to match milestone IDs.
3. **Priority field required**: Both milestones and tasks require a `priority:` field (`critical`, `high`, `medium`, `low`).

Additionally, ACP 5.19.0 added `started` (ISO 8601 timestamp) and `actual_hours` (auto-computed) fields to tasks.

The parser already handles `milestone_N` -> `MN` key mapping for tasks, but `normalizeMilestones()` only accepts arrays. We need to add a map detection branch.

---

## Steps

### 1. Update `src/lib/types.ts` — Add New Fields

Add to the `Milestone` interface:
```typescript
priority: 'critical' | 'high' | 'medium' | 'low'
file: string  // path to milestone document
```

Add to the `Task` interface:
```typescript
priority: 'critical' | 'high' | 'medium' | 'low'
started: string | null  // ISO 8601 timestamp
actual_hours: number | null
```

Export the `Priority` type:
```typescript
export type Priority = 'critical' | 'high' | 'medium' | 'low'
```

### 2. Update `src/lib/yaml-loader.ts` — Milestone Map Support

Modify `normalizeMilestones()` to detect and handle both formats:

```typescript
function normalizeMilestones(raw: unknown): Milestone[] {
  // v6 format: milestones is a map keyed by ID
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
```

### 3. Update `normalizeMilestone()` — Handle Priority and File

Add `priority` and `file` to `MILESTONE_KEYS`:
```typescript
const MILESTONE_KEYS = [
  'id', 'name', 'priority', 'file', 'status', 'progress', 'started', 'completed',
  'estimated_weeks', 'tasks_completed', 'tasks_total', 'notes',
]
```

In `normalizeMilestone()`, add:
```typescript
priority: normalizePriority(known.priority),
file: safeString(known.file),
```

### 4. Update `normalizeTask()` — Handle Priority, Started, Actual Hours

Add to `TASK_KEYS`:
```typescript
const TASK_KEYS = [
  'id', 'name', 'priority', 'status', 'milestone_id', 'file',
  'estimated_hours', 'actual_hours', 'started', 'completed_date', 'notes',
]
```

In `normalizeTask()`, add:
```typescript
priority: normalizePriority(known.priority),
started: known.started ? safeString(known.started) : null,
actual_hours: known.actual_hours != null ? safeNumber(known.actual_hours) : null,
```

### 5. Add `normalizePriority()` Helper

```typescript
function normalizePriority(value: unknown): Priority {
  const s = String(value || 'medium').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'low') return 'low'
  return 'medium' // default for missing/unknown
}
```

### 6. Verify Backward Compatibility

Ensure both formats parse correctly:
- Old format: milestones as array with `- id: milestone_1`, tasks keyed as `milestone_1`
- New format: milestones as map with `M1:` keys, tasks keyed as `M1`
- Mixed: some old projects may have `milestone_1` IDs — these should still work
- Missing priority: defaults to `'medium'`

---

## Verification

- [ ] `Milestone` interface has `priority` and `file` fields
- [ ] `Task` interface has `priority`, `started`, and `actual_hours` fields
- [ ] `Priority` type exported from types.ts
- [ ] `normalizeMilestones()` handles object (map) input — keys become milestone IDs
- [ ] `normalizeMilestones()` still handles array input (backward compat)
- [ ] `normalizePriority()` returns 'medium' for missing/unknown values
- [ ] `normalizeTask()` populates `priority`, `started`, `actual_hours`
- [ ] `normalizeMilestone()` populates `priority`, `file`
- [ ] ACP core progress.yaml (v6 map format) parses correctly
- [ ] Visualizer's own progress.yaml (pre-v6 array format) still parses correctly
- [ ] `npm run build` passes with no type errors

---

## Expected Output

**Files Modified**:
- `src/lib/types.ts` — Priority type, new fields on Milestone and Task
- `src/lib/yaml-loader.ts` — Map support in normalizeMilestones, normalizePriority helper, updated MILESTONE_KEYS and TASK_KEYS

---

## Key Design Decisions

### Backward Compatibility

| Decision | Choice | Rationale |
|---|---|---|
| Map vs array detection | Runtime typeof check | Same function handles both formats transparently |
| Missing priority | Default to 'medium' | Graceful degradation for pre-6.0.0 files |
| Missing started/actual_hours | null | Fields are optional in older schemas |

---

**Next Task**: [Task 16: Update UI for Priority Display](task-16-update-ui-for-priority-display.md)
**Estimated Completion Date**: TBD
