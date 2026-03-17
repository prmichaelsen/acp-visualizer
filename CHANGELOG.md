# Changelog

## [0.9.3] - 2026-03-17

### Added
- Mobile responsive MVP implementation
- Mobile drawer navigation with hamburger menu button
- Mobile card view for milestone table (replaces desktop table on small screens)
- Mobile-optimized header with responsive spacing and element visibility
- Full-screen side panel on mobile devices

### Changed
- Header padding adjusted to accommodate mobile menu button (pl-16 on mobile)
- Detail pages now use responsive padding (p-4 on mobile, p-6 on desktop)
- Task prev/next navigation now includes gap and truncate for better mobile UX
- Sidebar now slides in as drawer on mobile with backdrop overlay

## [0.9.2] - 2026-03-17

### Fixed
- Side panel icons now always visible (removed hover-only behavior)
- Side panel now properly closes when clicking "Open full view" button
- Replaced external link icon with maximize icon for better semantic meaning
- Fixed visual flash on side panel initial render by simplifying translate classes

## [0.8.1] - 2026-03-15

### Fixed
- Markdown tables not rendering — add remark-gfm plugin to react-markdown

## [0.8.0] - 2026-03-15

### Added
- Estimated vs Actual hours chart on overview page (horizontal bar chart per milestone)
- URL-based view/filter/search state on milestones page via TanStack Router search params
- Deep links now survive page refresh (e.g. `/milestones?view=kanban&status=in_progress`)

### Changed
- Default milestones view changed from table to tree
- Replaced milestones summary list on overview with Estimated vs Actual chart

## [0.7.0] - 2026-03-14

### Added
- Rewrite relative markdown links to visualizer routes in milestone and task detail pages
- Custom react-markdown link component resolves relative file paths to internal routes
- Link map built from progress data maps task/milestone file paths to visualizer URLs

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
