# Milestone 4: ACP 6.0.0 Compatibility Update

**Goal**: Update the visualizer to consume ACP 6.0.0 progress.yaml format (map-based milestones, normalized keys, priority field) while maintaining backward compatibility with pre-6.0.0 files.
**Duration**: 1-2 days
**Dependencies**: M3 (Detail Views) complete
**Status**: Not Started

---

## Overview

ACP 6.0.0 introduced breaking changes to progress.yaml structure: milestones changed from an array to a map keyed by milestone ID, task keys normalized from `milestone_1` to `M1`, and a required `priority` field was added to milestones and tasks. The visualizer's parser and data model must be updated to handle both the new and old formats.

---

## Deliverables

### 1. Parser & Data Model Updates
- `yaml-loader.ts` handles milestones as both map (v6) and array (pre-v6)
- `types.ts` includes `priority`, `started` (task), and `actual_hours` fields
- All existing progress.yaml files continue to load correctly

### 2. UI Priority Display
- PriorityBadge component with color-coded priority labels
- Priority column in MilestoneTable
- Priority shown in MilestoneTree, MilestoneKanban, and detail pages
- `actual_hours` displayed alongside `estimated_hours` on detail pages

### 3. Visualizer's Own progress.yaml Migrated
- progress.yaml converted to v6 map-based format
- All milestone and task keys normalized
- Priority field added to all entries

---

## Success Criteria

- [ ] Parser correctly loads ACP 6.0.0 map-based milestones
- [ ] Parser correctly loads pre-6.0.0 array-based milestones (backward compat)
- [ ] Priority field displayed in table, tree, kanban, and detail views
- [ ] `actual_hours` displayed on task detail pages when present
- [ ] Visualizer's own progress.yaml uses v6 format and loads correctly
- [ ] `npm run build` passes with no errors

---

## Key Files to Create/Modify

```
src/
├── lib/
│   ├── types.ts              (modify — add priority, started, actual_hours)
│   └── yaml-loader.ts        (modify — milestones-as-map support)
├── components/
│   └── PriorityBadge.tsx     (create — color-coded priority label)
├── routes/
│   ├── milestones.$milestoneId.tsx  (modify — show priority, actual_hours)
│   └── tasks.$taskId.tsx            (modify — show priority, actual_hours)
agent/
└── progress.yaml             (modify — convert to v6 format)
```

---

## Tasks

1. [Task 15: Update Data Model and Parser](../tasks/milestone-4-acp-6-compatibility/task-15-update-data-model-and-parser.md) - Map-based milestones, priority field, backward compat
2. [Task 16: Update UI for Priority Display](../tasks/milestone-4-acp-6-compatibility/task-16-update-ui-for-priority-display.md) - PriorityBadge, table/tree/kanban/detail updates
3. [Task 17: Migrate Visualizer progress.yaml to v6](../tasks/milestone-4-acp-6-compatibility/task-17-migrate-progress-yaml-to-v6.md) - Convert own progress.yaml to new format

---

## Risks and Mitigation

| Risk | Impact | Probability | Mitigation Strategy |
|------|--------|-------------|---------------------|
| Breaking existing progress.yaml loading | High | Low | Keep array path untouched, add map path as new branch |
| Priority field missing in old files | Medium | High | Default to 'medium' when absent |

---

**Next Milestone**: TBD (P2 features: Gantt, dependencies)
**Blockers**: None
**Notes**: Driven by ACP 6.0.0 breaking changes (CHANGELOG [6.0.0] - 2026-03-16)
