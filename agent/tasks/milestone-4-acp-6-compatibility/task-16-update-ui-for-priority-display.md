# Task 16: Update UI for Priority Display

**Milestone**: [M4 - ACP 6.0.0 Compatibility Update](../../milestones/milestone-4-acp-6-compatibility.md)
**Design Reference**: [Visualizer Requirements](../../design/local.visualizer-requirements.md)
**Estimated Time**: 2-3 hours
**Dependencies**: Task 15
**Status**: Not Started

---

## Objective

Create a PriorityBadge component and integrate priority display into all milestone/task views (table, tree, kanban, detail pages). Also display `actual_hours` alongside `estimated_hours` on detail pages.

---

## Context

Task 15 adds `priority` to Milestone and Task types. This task surfaces that data in the UI. The visualizer uses a consistent StatusBadge pattern — PriorityBadge should follow the same style with distinct colors per priority level.

---

## Steps

### 1. Create `src/components/PriorityBadge.tsx`

A small badge component similar to StatusBadge:

```tsx
interface PriorityBadgeProps {
  priority: 'critical' | 'high' | 'medium' | 'low'
}
```

Color mapping:
- `critical` — red/rose background
- `high` — orange/amber background
- `medium` — blue background (or neutral, since it's the default)
- `low` — gray background

Style: pill-shaped, small text, matching the existing StatusBadge visual weight.

### 2. Add Priority Column to `MilestoneTable.tsx`

Add a "Priority" column to the @tanstack/react-table column definition:
- Position: after Status column
- Renders `PriorityBadge`
- Sortable

### 3. Show Priority in `MilestoneTree.tsx`

Add PriorityBadge next to StatusBadge in milestone tree nodes (both milestone and task rows).

### 4. Show Priority in `MilestoneKanban.tsx`

Add PriorityBadge to kanban cards.

### 5. Update Milestone Detail Page (`milestones.$milestoneId.tsx`)

- Show PriorityBadge in the detail header metadata section
- In the task list within the milestone detail, show priority per task

### 6. Update Task Detail Page (`tasks.$taskId.tsx`)

- Show PriorityBadge in the detail header metadata
- Show `actual_hours` next to `estimated_hours` when present (e.g., "Est: 3h | Actual: 2.5h")
- Show `started` timestamp when present

---

## Verification

- [ ] PriorityBadge component renders all 4 priority levels with distinct colors
- [ ] MilestoneTable shows Priority column, sortable
- [ ] MilestoneTree shows priority badges on milestone and task rows
- [ ] MilestoneKanban shows priority badges on cards
- [ ] Milestone detail page shows priority in header
- [ ] Task detail page shows priority, actual_hours, started
- [ ] Pages render without errors when priority is missing (defaults to 'medium')
- [ ] `npm run build` passes

---

## Expected Output

**Files Created**:
- `src/components/PriorityBadge.tsx`

**Files Modified**:
- `src/components/MilestoneTable.tsx` — priority column
- `src/components/MilestoneTree.tsx` — priority badge
- `src/components/MilestoneKanban.tsx` — priority badge
- `src/routes/milestones.$milestoneId.tsx` — priority + task priority
- `src/routes/tasks.$taskId.tsx` — priority, actual_hours, started

---

**Next Task**: [Task 17: Migrate Visualizer progress.yaml to v6](task-17-migrate-progress-yaml-to-v6.md)
**Estimated Completion Date**: TBD
