# Task 13: Implement Detail Page Routes

**Milestone**: [M3 - Detail Views](../../milestones/milestone-3-detail-views.md)
**Design Reference**: [Milestone & Task Detail Views](../../design/local.milestone-task-detail-views.md)
**Estimated Time**: 4 hours
**Dependencies**: Task 11 (MarkdownContent component), Task 12 (markdown loading service)
**Status**: Not Started

---

## Objective

Create the milestone detail and task detail page routes with metadata headers, rendered markdown content, breadcrumb navigation, task lists (on milestone pages), and prev/next sibling navigation (on task pages).

---

## Context

The visualizer currently has list views (table, tree, kanban) but no drill-down pages. This task adds two new route files that load markdown content via the markdown service (Task 12) and render it using the MarkdownContent component (Task 11). Both pages share a common layout pattern: breadcrumb → metadata header → markdown body → related items.

---

## Steps

### 1. Create Milestone Detail Route

Create `src/routes/milestones.$milestoneId.tsx`:

**Data loading** (via `beforeLoad` or `loader`):
1. Get `milestoneId` from route params
2. Look up milestone in progress data (from ProgressContext or loader)
3. Call `resolveMilestoneFile` to get the markdown file path
4. Call `getMarkdownContent` to load the markdown
5. Get tasks for this milestone from progress data

**Page layout**:
```
Breadcrumb: Milestones > M1 - Project Scaffold & Data Pipeline
┌─────────────────────────────────────────┐
│ StatusBadge   ProgressBar (75%)         │
│ Started: 2026-03-14                     │
│ Est: 1 week   Tasks: 3/4 completed     │
│ Notes: Foundation milestone...          │
└─────────────────────────────────────────┘

[Rendered markdown content from milestone doc]

┌─────────────────────────────────────────┐
│ Tasks                                    │
│  ✓ Task 1: Initialize TanStack Start   │
│  ✓ Task 2: Implement Data Model        │
│  ● Task 3: Build Server API            │
│  ○ Task 4: Add Auto-Refresh            │
└─────────────────────────────────────────┘
```

**Metadata header** includes:
- StatusBadge (reuse existing component)
- ProgressBar (reuse existing component)
- Started/completed dates
- Estimated weeks
- Tasks completed/total
- Notes (if present)

**Task list** at the bottom:
- Each task shows StatusDot + linked title
- Links navigate to `/tasks/$taskId`

### 2. Create Task Detail Route

Create `src/routes/tasks.$taskId.tsx`:

**Data loading**:
1. Get `taskId` from route params
2. Look up task in progress data (search all milestone task arrays)
3. Determine parent milestone
4. Use `task.file` to call `getMarkdownContent`
5. Find prev/next sibling tasks in the same milestone

**Page layout**:
```
Breadcrumb: Milestones > M1 - Project Scaffold > Task 1: Initialize...
┌─────────────────────────────────────────┐
│ StatusBadge                              │
│ Est: 2 hours   Completed: 2026-03-14   │
│ Milestone: M1 - Project Scaffold (link) │
│ Notes: Scaffold project with Vite...    │
└─────────────────────────────────────────┘

[Rendered markdown content from task doc]

┌─────────────────────────────────────────┐
│ ← Task 0 (none)   Task 2: Data Model → │
└─────────────────────────────────────────┘
```

**Metadata header** includes:
- StatusBadge
- Estimated hours
- Completed date (if applicable)
- Parent milestone as a link to `/milestones/$milestoneId`
- Notes (if present)

**Prev/next navigation** at the bottom:
- Previous task link (or disabled if first task)
- Next task link (or disabled if last task)
- Tasks ordered by their position in the milestone's task array

### 3. Create Shared DetailHeader Component

Extract the metadata header into a reusable component since both pages use the same pattern:

```typescript
// src/components/DetailHeader.tsx
interface DetailHeaderProps {
  status: Status;
  fields: { label: string; value: React.ReactNode }[];
}
```

This renders a card with the status badge and a list of label/value pairs. Both the milestone and task pages compose this with their specific fields.

### 4. Create Breadcrumb Component

Create `src/components/Breadcrumb.tsx`:

```typescript
interface BreadcrumbProps {
  items: { label: string; href?: string }[];
}
```

- Items are rendered as `label > label > label`
- All items except the last are links
- The last item is plain text (current page)
- Milestone detail: `Milestones > M1 - Name`
- Task detail: `Milestones > M1 - Name > Task 1: Name`

### 5. Handle Missing Markdown

When the markdown file is not found (no milestone doc exists, or task file path is invalid):
- Show the metadata header normally (data comes from progress.yaml)
- Show a message in the content area: "No document found at `{path}`"
- Don't crash or show an error page — the metadata is still valuable

### 6. SSR Considerations

Both routes should load data via `beforeLoad` / `loader` to ensure SSR renders the full page (no loading spinner on initial load). The markdown content is fetched server-side and included in the initial HTML.

---

## Verification

- [ ] `/milestones/milestone_1` route loads and renders milestone detail
- [ ] `/tasks/task_1` route loads and renders task detail
- [ ] Metadata header shows status badge, dates, progress (milestones), hours (tasks)
- [ ] Markdown content renders correctly with syntax highlighting
- [ ] Breadcrumb shows correct hierarchy and links work
- [ ] Milestone detail page shows task list with links to task detail pages
- [ ] Task detail page shows parent milestone link
- [ ] Task detail page shows prev/next sibling navigation
- [ ] Missing markdown file shows graceful fallback (not error page)
- [ ] Pages render via SSR (view source shows content)
- [ ] Dark theme styling is consistent with dashboard

---

## Expected Output

**Files Created**:
- `src/routes/milestones.$milestoneId.tsx` — Milestone detail page
- `src/routes/tasks.$taskId.tsx` — Task detail page
- `src/components/DetailHeader.tsx` — Shared metadata header
- `src/components/Breadcrumb.tsx` — Breadcrumb navigation

---

## Key Design Decisions

### Layout

| Decision | Choice | Rationale |
|---|---|---|
| Content structure | Metadata header + markdown body | Structured data at a glance, full narrative below |
| Sidebar | Keep visible | Detail pages are part of the dashboard, not separate |
| Milestone tasks | Linked list at bottom of milestone detail | Natural drill-down from milestone to tasks |
| Sibling navigation | Prev/next at bottom of task detail | Browse through tasks without returning to list |

### Routing

| Decision | Choice | Rationale |
|---|---|---|
| URL parameter | Entity id (milestone_1, task_3) | Stable, concise, matches data model |
| Breadcrumb | Milestones > M1 > Task 1 | Standard drill-down pattern |
| Missing content | Show metadata + fallback message | Metadata from progress.yaml is always available |

---

**Next Task**: [Task 14: Integrate Navigation Links](task-14-navigation-links.md)
**Related Design Docs**: [local.milestone-task-detail-views.md](../../design/local.milestone-task-detail-views.md)
