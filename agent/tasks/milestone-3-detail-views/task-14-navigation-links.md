# Task 14: Integrate Navigation Links

**Milestone**: [M3 - Detail Views](../../milestones/milestone-3-detail-views.md)
**Design Reference**: [Milestone & Task Detail Views](../../design/local.milestone-task-detail-views.md)
**Estimated Time**: 2 hours
**Dependencies**: Task 13 (detail page routes exist)
**Status**: Not Started

---

## Objective

Make milestone and task titles clickable links in the existing table, tree, kanban, and task list views, navigating to their respective detail pages.

---

## Context

The detail page routes (`/milestones/$milestoneId` and `/tasks/$taskId`) are implemented but not yet reachable from the dashboard views. This task modifies existing components to wrap title text in router links. The click target is the **title text only**, not the entire row — this preserves existing row interactions (expansion, selection).

---

## Steps

### 1. Update MilestoneTable

In `src/components/MilestoneTable.tsx`:
- Find the column definition for the milestone name
- Wrap the name cell content in a `<Link>` from `@tanstack/react-router`
- Link target: `/milestones/${milestone.id}`
- Style the link to look like a text link (underline on hover, blue accent) while preserving the table cell layout
- Ensure the link click doesn't trigger row expansion

### 2. Update MilestoneTree

In `src/components/MilestoneTree.tsx`:
- Find where milestone names are rendered in tree nodes
- Wrap the name in a `<Link>` to `/milestones/${milestone.id}`
- Ensure the link click doesn't toggle the tree node expand/collapse (use `e.stopPropagation()` if needed)

### 3. Update MilestoneKanban

In `src/components/MilestoneKanban.tsx`:
- Find where milestone names are rendered in kanban cards
- Wrap the name in a `<Link>` to `/milestones/${milestone.id}`

### 4. Update TaskList

In `src/components/TaskList.tsx`:
- Find where task names are rendered
- Wrap the name in a `<Link>` to `/tasks/${task.id}`
- Style consistently with milestone links

### 5. Update Sidebar Navigation (Optional)

If the sidebar has a section for the current milestone or recent tasks, add links there too. Otherwise, skip this step.

### 6. Verify All Views

Test all views to ensure:
- Links navigate correctly
- Link styling is consistent across table, tree, kanban, and task list
- Row/node interactions (expansion, drag) are not broken by the links
- Browser back button returns to the previous view

---

## Verification

- [ ] Milestone name in MilestoneTable is a clickable link to `/milestones/$milestoneId`
- [ ] Milestone name in MilestoneTree is a clickable link to `/milestones/$milestoneId`
- [ ] Milestone name in MilestoneKanban is a clickable link to `/milestones/$milestoneId`
- [ ] Task name in TaskList is a clickable link to `/tasks/$taskId`
- [ ] Clicking a link navigates to the correct detail page
- [ ] Row expansion in table still works (click on row, not link)
- [ ] Tree expand/collapse still works (click on expand icon, not link)
- [ ] Link styling is consistent (hover underline, accent color)
- [ ] Browser back button returns to previous view

---

## Expected Output

**Files Modified**:
- `src/components/MilestoneTable.tsx` — Name column becomes link
- `src/components/MilestoneTree.tsx` — Node name becomes link
- `src/components/MilestoneKanban.tsx` — Card name becomes link
- `src/components/TaskList.tsx` — Task name becomes link

---

## Key Design Decisions

### Navigation

| Decision | Choice | Rationale |
|---|---|---|
| Click target | Title text only, not entire row | Preserves row expansion and other row-level interactions |
| Link behavior | Standard router navigation | Uses TanStack Router Link for client-side navigation |

---

**Next Task**: None (M3 complete)
**Related Design Docs**: [local.milestone-task-detail-views.md](../../design/local.milestone-task-detail-views.md)
