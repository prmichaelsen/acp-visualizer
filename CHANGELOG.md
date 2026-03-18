# Changelog

## [0.12.0] - 2026-03-18

### Added
- Draggable, resizable sidepanel with push-content layout
- Resize handle on left edge of sidepanel with visual feedback
- Width persistence during session (300-800px range)
- Smooth transition animations for panel open/close

### Changed
- Sidepanel no longer overlays content but pushes main area to the left
- Removed backdrop overlay in favor of integrated document flow
- Panel width is now user-adjustable via drag interaction

### Fixed
- React hooks violation by moving conditional return after all hooks

## [0.11.1] - 2026-03-18

### Added
- GitHub tab with full-page repository list experience
- Repository metadata display (stars, forks, language, private badge)
- Search/filter functionality for GitHub repos
- Click-to-load any repository directly from the list

## [0.11.0] - 2026-03-18

### Added
- GitHub OAuth authentication for private repository access
- Repository search typeahead for authenticated users
- OAuth callback route at `/auth/github/callback`
- GitHub sign-in/sign-out UI in sidebar
- Token storage in localStorage with CSRF state protection
- Authenticated API requests for private repos and higher rate limits

### Changed
- GitHub input placeholder changes based on auth state ("Search your repos..." vs "owner/repo")
- GitHub API calls now include Authorization header when token is available
- Repository suggestions dropdown shows when typing (authenticated users only)

## [0.10.3] - 2026-03-18

### Fixed
- Repo URL parameter now properly reloads on page refresh
- GitHub repo data takes precedence over local data when ?repo= param is present

## [0.10.2] - 2026-03-18

### Added
- Mobile scroll hint for Gantt chart timeline
- Mobile warning banner for Dependency Graph with usage guidance

### Changed
- Gantt chart now horizontally scrollable on mobile with minimum 800px width
- Gantt month labels increased from 10px to 12px on mobile for better readability
- Gantt milestone label width reduced on mobile (w-32) to save space
- Dependency Graph wrapped in scrollable container for mobile overflow

## [0.10.1] - 2026-03-18

### Changed
- EstimateChart now uses responsive Y-axis width (120px on mobile, 180px on desktop)
- Chart height adjusts based on screen size for better mobile display

## [0.10.0] - 2026-03-18

### Added
- Mobile-responsive ViewToggle with horizontal scroll and 44px touch targets
- Mobile-responsive FilterBar with button wrapping on small screens
- Responsive Kanban columns (1 col mobile, 2 cols tablet, 3-4 cols desktop)

### Changed
- ViewToggle buttons increased from text-xs to text-sm for better readability
- FilterBar buttons now wrap to multiple rows on mobile instead of single row
- Kanban view now stacks vertically on mobile, progressively showing more columns on larger screens
- All button touch targets increased to minimum 44x44px for mobile usability

## [0.9.5] - 2026-03-18

### Changed
- Mobile drawer now slides up from bottom instead of left (better mobile UX pattern)
- Hamburger menu button transforms to X when drawer is open
- Clicking X button closes the drawer
- Drawer has rounded top corners on mobile (rounded-t-2xl)
- Drawer limited to 80vh max height on mobile with scrollable content
- Navigation links now auto-close drawer when clicked on mobile

## [0.9.4] - 2026-03-17

### Changed
- Menu button moved to bottom-right corner (thumb zone) for better one-handed mobile use
- Menu button styled as floating action button (FAB) with rounded-full design

### Fixed
- All input fields now use minimum 16px font size to prevent iOS Safari auto-zoom
- Search and GitHub input fields resized with better spacing and icon positioning

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
