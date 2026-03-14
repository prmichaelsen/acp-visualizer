# Unified Header & Navigation

**Category**: Design
**Applicable To**: All page headers, tab navigation, mobile menus, and back navigation
**Status**: Stable

---

## Overview

The header system provides a fixed 56px top bar (`UnifiedHeader`) with optional sub-header tabs (`SubHeaderTabs`), inline filter tabs (`FilterTabs`), smart back navigation, mobile hamburger menu, and notification bell integration. All pages share the same header chrome via this system. Content below the header uses `pt-14` (which includes `env(safe-area-inset-top)` via CSS override).

---

## When to Use This Pattern

**Use this pattern when:**
- Creating any new page that needs a header bar
- Adding tab navigation to a page (sub-header or inline)
- Building a page with action buttons in the header
- Implementing a new mobile-responsive navigation flow

**Don't use this pattern when:**
- Building a full-screen overlay (lightbox, modal) — these have their own chrome
- Creating a landing/marketing page with custom header design

---

## Core Principles

1. **Fixed Position + Safe Area**: Header is `fixed top-0` with `paddingTop: env(safe-area-inset-top)` for notch support
2. **Content Offset**: All content below uses `pt-14` (56px + safe area via CSS override in `styles.css`)
3. **Two-Tier Structure**: Main bar (always) + optional sub-header children (tabs)
4. **Smart Back Button**: Shows when `title` is set; uses `router.history.back()` with `/` fallback
5. **Max-Width Container**: `max-w-3xl mx-auto` keeps content centered and readable

---

## Implementation

### UnifiedHeader

**File**: `src/components/UnifiedHeader.tsx`

```typescript
interface UnifiedHeaderProps {
  /** Page title. Omit for homepage mode (shows "agentbase" branding). */
  title?: string
  /** Icon displayed next to the title. */
  icon?: ReactNode
  /** When true, renders the icon as-is instead of wrapping in a gradient circle. */
  iconRaw?: boolean
  /** Callback for the ellipsis (⋮) button. Page owns the panel/menu. */
  onEllipsisPress?: () => void
  /** Action buttons rendered directly in the header bar. */
  headerActions?: ReactNode
  /** SubHeaderTabs or other content rendered below the main bar. */
  children?: ReactNode
}
```

**Structure**:

```
<header fixed top-0 z-50 w-full>
  ├─ <div h-14 border-b>              ← Main bar (56px)
  │   └─ <div max-w-3xl mx-auto>
  │       ├─ [Back button + separator] ← Only when title is set
  │       ├─ [Icon] + [Title]          ← Or branding if no title
  │       ├─ <flex-1 spacer />
  │       ├─ [headerActions]           ← Custom action buttons
  │       ├─ [Ellipsis button]         ← If onEllipsisPress provided
  │       ├─ [NotificationBell]        ← If real user
  │       └─ [Hamburger menu button]
  └─ {children}                        ← SubHeaderTabs go here

{mobileMenuOpen && <MobileMenu />}     ← Dropdown below header
```

**Exported Constants**:

```typescript
export const HEADER_HEIGHT_CLASS = 'pt-14'  // Padding for content below header
export const HEADER_TOP_CLASS = 'top-14'    // Top offset for fixed elements below header
```

**Back Navigation Logic**:

```typescript
const handleBack = () => {
  if (window.history.length > 1) {
    router.history.back()
  } else {
    window.location.href = '/'
  }
}
// Back button only renders when title is set (non-homepage)
```

**Mobile Menu**: Fixed dropdown below header (`top-14`) with:
- Navigation links (Chat, Conversations, Memories, etc.)
- Collapsible "Social" subsection with ChevronDown rotation
- Auth section: loading skeleton / user email + logout / login link
- Auto-closes on link click

---

### SubHeaderTabs

**File**: `src/components/SubHeaderTabs.tsx`

Rendered as `children` of UnifiedHeader, below the main bar.

```typescript
export interface SubHeaderTab {
  id: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'ghost'
}

interface SubHeaderTabsProps {
  tabs: SubHeaderTab[]
  activeId: string
  onSelect: (id: string) => void
}
```

**Behavior**:
- Horizontal scrollable with `-webkit-overflow-scrolling: touch` and hidden scrollbar
- Active tab: 2px bottom border (`border-purple-500`) + white/purple text
- Inactive tab: gray text with hover transition
- Buttons use `min-w-min` to prevent shrinking

**Usage**:

```typescript
<UnifiedHeader title="Organize">
  <SubHeaderTabs
    tabs={[
      { id: 'unorganized', label: 'Unorganized', icon: <FolderOpen className="w-4 h-4" /> },
      { id: 'relationships', label: 'Relationships', icon: <Waypoints className="w-4 h-4" /> },
    ]}
    activeId={activeTab}
    onSelect={setActiveTab}
  />
</UnifiedHeader>
```

**Content Offset with Tabs**: Use `pt-header-tabs` (6rem + safe area) instead of `pt-14` when SubHeaderTabs are present.

---

### FilterTabs

**File**: `src/components/feed/FilterTabs.tsx`

Inline pill-style filter controls rendered within page content (not in header).

```typescript
export interface FilterTab {
  id: string
  label: string
  icon?: ReactNode
}

interface FilterTabsProps {
  tabs: FilterTab[]
  activeId: string
  onSelect: (id: string) => void
  hidden?: boolean
  className?: string
}
```

**Behavior**:
- Container: `flex gap-1 mb-4 p-1 bg-gray-800/50 rounded-lg overflow-x-auto`
- Active button: gradient background (`from-purple-600 to-blue-600`), white text, shadow
- Inactive button: gray text, hover effects
- Can be hidden with `hidden` prop
- `whitespace-nowrap` on buttons prevents text wrapping

**Usage**:

```typescript
<FilterTabs
  tabs={[
    { id: 'all', label: 'All', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'agent', label: 'Agent', icon: <Bot className="w-3.5 h-3.5" /> },
  ]}
  activeId={contentView}
  onSelect={setContentView}
/>
```

---

### Layout Routes with Outlet

**Pattern**: Keep feeds mounted while showing detail views via TanStack Router layout routes.

```
/memories.tsx           ← Layout with feed + <Outlet />
/memories/index.tsx     ← Feed content (hidden when detail showing)
/memories/$memoryId.tsx ← Detail view (renders via Outlet)
```

```typescript
function MemoriesLayout() {
  const indexMatch = useMatch({ from: '/memories/', shouldThrow: false })
  const showingDetail = !indexMatch

  return (
    <>
      {/* Feed — hidden via CSS, stays mounted to preserve state */}
      <div style={{ display: showingDetail ? 'none' : undefined }}>
        <UnifiedHeader title="Memories">
          <SubHeaderTabs ... />
        </UnifiedHeader>
        <main className="pt-header-tabs">
          {/* Feed content */}
        </main>
      </div>
      {/* Detail — renders when child route matches */}
      {showingDetail && <Outlet />}
    </>
  )
}
```

**Key**: Use `display: none` (not unmount) to preserve scroll position, loaded items, and filter state.

---

## Anti-Patterns

### Forgetting `pt-14` Below Fixed Header

```typescript
// Bad: Content renders behind the fixed header
<UnifiedHeader title="Page" />
<main>{content}</main>

// Good: Offset content below header
<UnifiedHeader title="Page" />
<main className="pt-14">{content}</main>

// Good (with tabs): Use pt-header-tabs
<UnifiedHeader title="Page"><SubHeaderTabs ... /></UnifiedHeader>
<main className="pt-header-tabs">{content}</main>
```

### Using SubHeaderTabs Outside UnifiedHeader

```typescript
// Bad: Tabs render without proper fixed positioning
<UnifiedHeader title="Page" />
<SubHeaderTabs tabs={tabs} activeId={id} onSelect={fn} />

// Good: Pass as children to UnifiedHeader
<UnifiedHeader title="Page">
  <SubHeaderTabs tabs={tabs} activeId={id} onSelect={fn} />
</UnifiedHeader>
```

---

## Checklist

- [ ] `UnifiedHeader` used on every page (with or without title)
- [ ] `pt-14` applied to content container (or `pt-header-tabs` when tabs present)
- [ ] Tab state synced to URL via `validateSearch` + `navigate({ search })` for deep-linkability
- [ ] Mobile menu items auto-close on navigation
- [ ] Safe-area-inset-top applied via inline style on fixed header element

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
