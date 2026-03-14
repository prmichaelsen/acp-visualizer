# Task 12: Build Markdown Loading Service

**Milestone**: [M3 - Detail Views](../../milestones/milestone-3-detail-views.md)
**Design Reference**: [Milestone & Task Detail Views](../../design/local.milestone-task-detail-views.md)
**Estimated Time**: 3 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Create a server-side service that loads markdown file content for milestones and tasks from both local filesystem and GitHub remote sources, with milestone file resolution by directory scanning.

---

## Context

Task documents have a `file` field (e.g., `agent/tasks/milestone-1-.../task-1-....md`) that points directly to their markdown file. Milestones do not have a `file` field in the current data model, so their files must be discovered by scanning `agent/milestones/` for files whose name contains the milestone id. The service must work in both local mode (read from disk) and GitHub mode (fetch via GitHub API), using the same base path/config as the existing `ProgressDatabaseService`.

---

## Steps

### 1. Create Markdown Service

Create `src/services/markdown.service.ts` with a TanStack `createServerFn`:

```typescript
import { createServerFn } from '@tanstack/react-start';

export const getMarkdownContent = createServerFn({ method: 'GET' })
  .inputValidator((input: { filePath: string; source: 'local' | 'github' }) => input)
  .handler(async ({ input }) => {
    if (input.source === 'local') {
      return readLocalMarkdown(input.filePath);
    } else {
      return readGithubMarkdown(input.filePath);
    }
  });
```

Note: Uses `.inputValidator()` (not `.validator()`) per project conventions.

### 2. Implement Local Filesystem Reader

Read markdown from the local filesystem:
- Derive the base directory from the `PROGRESS_YAML_PATH` environment variable (strip the filename to get the project root)
- Resolve the `filePath` relative to that base directory
- Read the file with `fs.readFileSync` (or async equivalent)
- Return `{ content: string, filePath: string }` or `{ error: string }` if file not found

### 3. Implement GitHub Reader

Fetch markdown from GitHub using the existing GitHub service pattern:
- Use the GitHub Contents API: `GET /repos/{owner}/{repo}/contents/{path}`
- Decode the base64 response body
- Support the same auth token pattern used by the existing GitHub data source
- Return the same shape as the local reader

### 4. Implement Milestone File Resolution

Create a function to resolve a milestone id to a file path:

```typescript
export const resolveMilestoneFile = createServerFn({ method: 'GET' })
  .inputValidator((input: { milestoneId: string; source: 'local' | 'github' }) => input)
  .handler(async ({ input }) => {
    // Extract the numeric part: "milestone_1" → "1"
    // Scan agent/milestones/ for files matching "milestone-1-*"
    // Return the first match, or null if not found
  });
```

**Local mode**: Use `fs.readdirSync` on `{basePath}/agent/milestones/`, filter for files matching `milestone-{N}-*.md` (excluding template files).

**GitHub mode**: Use GitHub Contents API to list the `agent/milestones/` directory, filter similarly.

### 5. Implement Task File Resolution

Task resolution is simpler — use the `task.file` field directly:

```typescript
export const resolveTaskFile = createServerFn({ method: 'GET' })
  .inputValidator((input: { taskId: string; tasks: Record<string, Task[]> }) => input)
  .handler(async ({ input }) => {
    // Search all milestone task arrays for matching task id
    // Return task.file if found, null otherwise
  });
```

This can also be done client-side since the task data is already loaded in `ProgressContext`.

### 6. Error Handling

Handle gracefully:
- File not found (milestone has no corresponding markdown file)
- Permission errors (local filesystem)
- GitHub API errors (rate limiting, auth, 404)
- Return structured error objects so the detail page can show appropriate empty states

---

## Verification

- [ ] `getMarkdownContent` server function reads local markdown files correctly
- [ ] `getMarkdownContent` fetches markdown from GitHub API correctly
- [ ] `resolveMilestoneFile` finds the correct file by scanning `agent/milestones/`
- [ ] `resolveMilestoneFile` excludes template files from scan results
- [ ] `resolveTaskFile` returns the correct `task.file` path
- [ ] Base path derived from `PROGRESS_YAML_PATH` correctly
- [ ] File not found returns structured error (not crash)
- [ ] GitHub 404 returns structured error
- [ ] Works end-to-end: milestone id → file path → markdown content

---

## Expected Output

**Files Created**:
- `src/services/markdown.service.ts` — Server functions for markdown loading and file resolution

**Files Modified**:
- None (new service, consumed by routes in Task 13)

---

## Key Design Decisions

### Data Loading

| Decision | Choice | Rationale |
|---|---|---|
| Milestone file resolution | Scan directory by id pattern | Backwards compatible with progress.yaml files that lack a `file` field |
| Base path | Derived from PROGRESS_YAML_PATH | Single config source; consistent with ProgressDatabaseService |
| GitHub support | Yes, via existing GitHub service pattern | Users expect full dashboard to work in hosted mode |

---

**Next Task**: [Task 13: Implement Detail Page Routes](task-13-detail-page-routes.md)
**Related Design Docs**: [local.milestone-task-detail-views.md](../../design/local.milestone-task-detail-views.md)
