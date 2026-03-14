# Milestone 3: Detail Views

**Goal**: Add clickable milestone/task detail pages that render markdown content from ACP documents with metadata headers, breadcrumbs, and sibling navigation
**Duration**: 1 week
**Dependencies**: M2 - Dashboard Views & Interaction
**Status**: Not Started
**Priority**: P1

---

## Overview

This milestone adds drill-down detail pages to the visualizer. Clicking a milestone or task title navigates to a dedicated route that displays a metadata header (status, progress, dates) followed by the rendered markdown content of the corresponding ACP document. Both local filesystem and GitHub remote data sources are supported.

---

## Deliverables

### 1. Markdown Rendering Infrastructure
- react-markdown, rehype-highlight, @tailwindcss/typography installed
- MarkdownContent component with dark theme prose styling
- Syntax-highlighted code blocks

### 2. Markdown Loading Service
- Server function to read markdown files from local filesystem or GitHub
- Milestone file resolution (scan `agent/milestones/` by id)
- Task file resolution (use `task.file` field)

### 3. Detail Page Routes
- `/milestones/$milestoneId` route with metadata header + markdown body
- `/tasks/$taskId` route with metadata header + markdown body
- Breadcrumb navigation on both pages
- Task list on milestone detail page
- Prev/next sibling navigation on task detail page

### 4. Navigation Integration
- Milestone titles in MilestoneTable/MilestoneTree become links
- Task titles in TaskList become links
- Links navigate to detail routes

---

## Success Criteria

- [ ] Clicking a milestone title in table/tree view navigates to `/milestones/$milestoneId`
- [ ] Clicking a task title in TaskList navigates to `/tasks/$taskId`
- [ ] Detail pages render markdown with syntax-highlighted code blocks
- [ ] Metadata header shows status badge, progress, dates
- [ ] Breadcrumb navigation works (back to list views)
- [ ] Milestone detail page lists its tasks with links
- [ ] Task detail page shows prev/next sibling links
- [ ] Works in both local and GitHub remote mode
- [ ] Dark theme styling consistent with dashboard

---

## Tasks

1. [Task 11: Install Markdown Dependencies & Build MarkdownContent Component](../tasks/milestone-3-detail-views/task-11-markdown-rendering-infrastructure.md)
2. [Task 12: Build Markdown Loading Service](../tasks/milestone-3-detail-views/task-12-markdown-loading-service.md)
3. [Task 13: Implement Detail Page Routes](../tasks/milestone-3-detail-views/task-13-detail-page-routes.md)
4. [Task 14: Integrate Navigation Links](../tasks/milestone-3-detail-views/task-14-navigation-links.md)

---

## Testing Requirements

- [ ] MarkdownContent renders headings, lists, code blocks, tables correctly
- [ ] Milestone file resolution finds correct file by id scan
- [ ] Task file resolution uses `task.file` field correctly
- [ ] Detail pages load via SSR (no loading spinner)
- [ ] Breadcrumb and sibling navigation links are correct
- [ ] GitHub remote mode fetches and renders markdown

---

**Next Milestone**: None (P1 complete)
**Blockers**: None
**Notes**: Design document: agent/design/local.milestone-task-detail-views.md
