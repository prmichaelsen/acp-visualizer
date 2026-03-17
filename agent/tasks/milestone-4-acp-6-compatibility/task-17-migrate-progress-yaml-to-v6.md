# Task 17: Migrate Visualizer progress.yaml to v6 Format

**Milestone**: [M4 - ACP 6.0.0 Compatibility Update](../../milestones/milestone-4-acp-6-compatibility.md)
**Design Reference**: None
**Estimated Time**: 1-2 hours
**Dependencies**: Task 15
**Status**: Not Started

---

## Objective

Convert the visualizer's own `agent/progress.yaml` from pre-6.0.0 array format to v6.0.0 map-based format, normalize all task keys, and add the required `priority` field to all milestones and tasks.

---

## Context

The visualizer's progress.yaml currently uses the old format:
- `milestones:` is an array with `- id: milestone_1`
- `tasks:` keys are `milestone_1`, `milestone_2`, `milestone_3`
- No `priority` field on milestones or tasks

After this migration it should use:
- `milestones:` as a map with `M1:`, `M2:`, `M3:`, `M4:` keys
- `tasks:` keys as `M1`, `M2`, `M3`, `M4`
- `priority:` on every milestone and task entry
- `current_milestone:` using `M4` format (not `milestone_3`)

---

## Steps

### 1. Convert Milestones Array to Map

Replace:
```yaml
milestones:
  - id: milestone_1
    name: Project Scaffold & Data Pipeline
    ...
  - id: milestone_2
    ...
```

With:
```yaml
milestones:
  M1:
    name: Project Scaffold & Data Pipeline
    priority: high
    ...
  M2:
    ...
```

Remove `id:` field from each entry (the map key IS the ID).

### 2. Normalize Task Keys

Replace `milestone_1:`, `milestone_2:`, `milestone_3:` under `tasks:` with `M1:`, `M2:`, `M3:`.

Add the new `M4:` section for milestone-4 tasks (15-17).

### 3. Add Priority Field

Add `priority:` to every milestone and task. Use these defaults:
- All milestones: `high` (they're all core functionality)
- All tasks: `high` (they were all P0/P1 scope)
- M4 milestone: `high` (compatibility fix)
- M4 tasks: `high`

### 4. Update current_milestone

Change `current_milestone: milestone_3` to `current_milestone: M4`.

### 5. Add started/actual_hours to Tasks (Optional)

If timestamps are available from git history, add `started:` and `actual_hours:` to completed tasks. Otherwise set to `null`.

### 6. Verify Roundtrip

Start the dev server and confirm the dashboard loads correctly with the migrated file. Check:
- Overview page shows correct project metadata
- All 4 milestones appear in table/tree views
- All tasks appear under correct milestones
- Detail pages load correctly
- Priority badges render

---

## Verification

- [ ] `milestones:` is a map with M1/M2/M3/M4 keys
- [ ] `id:` field removed from milestone entries
- [ ] `tasks:` keys are M1/M2/M3/M4
- [ ] Every milestone has `priority:` field
- [ ] Every task has `priority:` field
- [ ] `current_milestone:` uses M-format
- [ ] Dashboard loads without errors
- [ ] All milestones and tasks display correctly in table, tree, kanban views
- [ ] Detail pages work for milestones and tasks
- [ ] `npm run build` passes

---

## Expected Output

**Files Modified**:
- `agent/progress.yaml` — full v6 format migration

---

**Next Task**: None (milestone complete)
**Estimated Completion Date**: TBD
