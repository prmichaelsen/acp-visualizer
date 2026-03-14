# Changelog

## [0.6.1] - 2026-03-14

### Fixed
- Split milestones/tasks into layout+index routes so detail page child routes render correctly
- Wrap ReactMarkdown in div for className prop (removed in react-markdown v10)

## [0.6.0] - 2026-03-14

### Added
- Milestone detail pages (`/milestones/$milestoneId`) with metadata header and rendered markdown content
- Task detail pages (`/tasks/$taskId`) with metadata header, rendered markdown, and prev/next sibling navigation
- Markdown rendering via react-markdown with syntax-highlighted code blocks (rehype-highlight)
- Dark-theme prose styling via @tailwindcss/typography
- Markdown loading service supporting both local filesystem and GitHub remote sources
- Milestone file resolution by scanning `agent/milestones/` directory
- Breadcrumb navigation on detail pages
- Clickable milestone titles in table, tree, and kanban views
- Clickable task titles in task list views
- Task list with links on milestone detail pages

## [0.5.3] - 2026-03-14

### Fixed
- Disable Cloudflare vite plugin in local dev mode
- Fall back to probing main/mainline/master when GitHub API branch detection fails
- Auto-detect default branch instead of hardcoding main
- Prevent /api/watch SSE hang on Cloudflare Workers
