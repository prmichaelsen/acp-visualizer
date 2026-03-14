# Milestone & Task Detail Views

**Concept**: Clickable milestone/task detail pages that render markdown content from ACP task and milestone documents
**Created**: 2026-03-14
**Status**: Design Specification

---

## Overview

Add detail pages for milestones and tasks in the visualizer. Clicking a milestone or task title navigates to a dedicated route that displays a metadata header (status badge, progress, dates) followed by the rendered markdown content of the corresponding ACP document. This bridges the gap between the dashboard's structured views and the rich narrative content in task/milestone markdown files.

---

## Problem Statement

The visualizer currently shows milestones and tasks as rows in tables/trees with structured fields (status, progress %, dates). However, the actual ACP task and milestone documents contain detailed implementation steps, acceptance criteria, design context, and notes that are invisible in the dashboard. Users must leave the visualizer and open markdown files manually to see this content.

---

## Solution

Add two new route families (`/milestones/$milestoneId` and `/tasks/$taskId`) that:

1. Load the corresponding markdown file from the ACP project directory (local) or GitHub (remote)
2. Render a metadata header with structured fields (status, progress, dates, links)
3. Render the markdown body using `react-markdown` with syntax highlighting
4. Provide breadcrumb navigation and sibling task prev/next links

### Alternative Approaches Considered

- **Modal/slide-over**: Rejected — full-page route is more linkable and fits the existing routing model
- **Inline expansion in table**: Already exists for tasks but limited to summary data, not full markdown
- **Iframe embed**: Rejected — poor styling integration, no metadata header

---

## Implementation

### Routes

```
/milestones/$milestoneId    →  MilestoneDetailPage
/tasks/$taskId              →  TaskDetailPage
```

Routes use the entity `id` field (e.g., `milestone_1`, `task_3`) as the URL parameter. The server resolves the id to a file path for markdown loading.

### Milestone File Resolution

Milestones don't currently have a `file` field in `progress.yaml`. The server uses a two-step resolution:

1. **Scan** `agent/milestones/` for files whose name contains the milestone id (e.g., `milestone-1-*`)
2. **Future**: A `file` field can be added to milestone entries in progress.yaml for explicit mapping

This provides backwards compatibility with existing progress.yaml files while supporting explicit paths going forward.

### Markdown Loading

A new server function reads markdown content:

```typescript
// src/services/markdown.service.ts
import { createServerFn } from '@tanstack/react-start';

const getMarkdownContent = createServerFn({ method: 'GET' })
  .inputValidator((input: { filePath: string }) => input)
  .handler(async ({ input }) => {
    // Local mode: read from filesystem relative to project root
    // GitHub mode: fetch via GitHub Contents API
    const content = await readFile(input.filePath);
    return { content, filePath: input.filePath };
  });
```

The base path is derived from the same `PROGRESS_YAML_PATH` config used for progress.yaml loading. For GitHub mode, the file is fetched via the existing GitHub service.

### Markdown Rendering

```typescript
// New dependency: react-markdown + rehype-highlight (or similar)
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      className="prose prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  );
}
```

- **react-markdown** for rendering
- **rehype-highlight** (or `rehype-prism`) for syntax highlighting in code blocks
- Tailwind `prose prose-invert` for dark-theme-consistent typography

### Detail Page Layout

Both milestone and task detail pages share a common layout:

```
┌─────────────────────────────────────────────┐
│ Sidebar │  Breadcrumb: Milestones > M1      │
│         │                                    │
│         │  ┌──────────────────────────────┐  │
│         │  │ Status Badge  Progress Bar   │  │
│         │  │ Started: ...  Est: ... weeks │  │
│         │  │ Tasks: 4/4 completed         │  │
│         │  └──────────────────────────────┘  │
│         │                                    │
│         │  ## Rendered Markdown Content       │
│         │  ...                                │
│         │                                    │
│         │  ┌──────────────────────────────┐  │
│         │  │ Tasks in this milestone:     │  │
│         │  │  • Task 1 (link)             │  │
│         │  │  • Task 2 (link)             │  │
│         │  └──────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Milestone detail page** includes:
- Metadata header (status, progress bar, dates, task count)
- Rendered markdown body
- Task list with links to task detail pages

**Task detail page** includes:
- Metadata header (status, estimated hours, completion date, notes)
- Parent milestone link in breadcrumb
- Rendered markdown body
- Prev/next sibling task navigation (within same milestone)

### Navigation

- **Click target**: Milestone/task **title text** (not entire row) becomes a link
- **Breadcrumb**: Shown at top of detail page (e.g., `Milestones > M1 - Project Scaffold`)
- **Back navigation**: Breadcrumb links return to list views
- **Sibling navigation**: Task detail pages show prev/next links to adjacent tasks in the same milestone

### Dependencies (new packages)

```json
{
  "react-markdown": "^9.x",
  "rehype-highlight": "^7.x",
  "@tailwindcss/typography": "^0.5.x"
}
```

---

## Benefits

- **Full context**: Users see complete task/milestone documentation without leaving the dashboard
- **Linkable**: Detail pages have stable URLs for sharing/bookmarking
- **Consistent UX**: Markdown rendered with the same dark theme as the rest of the app
- **Navigation flow**: Breadcrumbs and sibling links create a natural drill-down/browse experience

---

## Trade-offs

- **Additional packages**: react-markdown + rehype-highlight + @tailwindcss/typography adds ~50KB bundled (acceptable for the value)
- **File resolution complexity**: Milestone file scanning adds a directory read per detail page load (cached by SSR, negligible impact)
- **Remote latency**: GitHub mode adds an API call per detail page (mitigated by caching and the existing GitHub service pattern)

---

## Dependencies

- react-markdown (markdown rendering)
- rehype-highlight (syntax highlighting)
- @tailwindcss/typography (prose styling)
- Existing ProgressDatabaseService (data context)
- Existing GitHub service (remote mode)

---

## Testing Strategy

- **Unit tests**: Milestone file resolution (scan + match logic)
- **Component tests**: MarkdownContent renders headings, code blocks, lists correctly
- **Integration tests**: Detail page loads real markdown file and renders
- **Navigation tests**: Title links navigate to correct detail route, breadcrumbs work, prev/next links cycle through tasks

---

## Migration Path

No migration needed. This is additive:

1. Add new route files (`milestones.$milestoneId.tsx`, `tasks.$taskId.tsx`)
2. Add markdown service
3. Install new dependencies
4. Add title links to existing MilestoneTable, MilestoneTree, TaskList components

Existing views are unchanged; detail pages are purely new routes.

---

## Key Design Decisions

### Routing

| Decision | Choice | Rationale |
|---|---|---|
| URL parameter | Entity `id` (e.g., `task_1`) | Stable, concise, matches data model primary key |
| Click target | Title text, not entire row | Preserves row click for expansion; title is the natural link affordance |
| Breadcrumb | Yes, with back navigation | Standard drill-down UX pattern |

### Data Loading

| Decision | Choice | Rationale |
|---|---|---|
| Markdown source path | Same base path as progress.yaml | Consistent config; single `PROGRESS_YAML_PATH` controls everything |
| Milestone file resolution | Scan `agent/milestones/` + future `file` field | Backwards compatible with existing progress.yaml; forward compatible with explicit paths |
| Remote/GitHub support | Yes, detail views work in hosted mode | Users expect the full dashboard to work when pointed at a GitHub repo |

### Rendering

| Decision | Choice | Rationale |
|---|---|---|
| Markdown library | react-markdown | Most popular React solution, good plugin ecosystem |
| Syntax highlighting | Yes, via rehype-highlight | Task docs contain code blocks that need to be readable |
| Theme | Dark theme matching dashboard | Consistent visual experience via Tailwind prose-invert |

### Layout

| Decision | Choice | Rationale |
|---|---|---|
| Content structure | Metadata header + markdown body | Structured data at a glance, full narrative below |
| Sidebar | Keep visible | Consistent app shell; detail pages are part of the dashboard, not a separate mode |
| Related items | Milestone shows task list; task shows prev/next siblings | Natural navigation between related entities |

---

## Future Considerations

- **Edit mode**: Allow editing markdown in-browser and writing back to disk (P3)
- **Table of contents**: Auto-generated sidebar TOC from markdown headings for long documents
- **Search within document**: Ctrl+F-style search scoped to the rendered markdown
- **Design document detail views**: Extend the same pattern to `agent/design/*.md` files
- **Anchor links**: Deep links to specific sections within a document

---

**Status**: Design Specification
**Recommendation**: Create milestone (M3) and task breakdown for implementation
**Related Documents**: clarification-1-milestone-task-detail-views.md, local.visualizer-requirements.md
