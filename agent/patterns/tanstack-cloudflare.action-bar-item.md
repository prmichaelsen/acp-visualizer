# ActionBarItem System

**Category**: Design
**Applicable To**: All action bars, action menus, card action strips, and any surface rendering a set of user actions with popovers/modals
**Status**: Specification (not yet implemented)

---

## Overview

The ActionBarItem system is a config-driven abstraction for composable, portable action items. Each action (rate, delete, publish, share, etc.) is a self-contained object returned by a hook, bundling its icon, state, handler, popover content, and modals. A generic `ActionBar` container iterates items and handles layout + popover orchestration. The same items render identically in horizontal bars, vertical menus, compact card strips, and slide-over panels — no rewiring needed.

---

## When to Use This Pattern

**Use this pattern when:**
- Building an action bar with multiple actions that need popovers or modals
- Adding the same action (delete, publish, rate) to multiple surfaces
- Rendering actions in different layouts (horizontal icons, vertical menu, compact strip)
- Composing action sets from per-concern hooks

**Don't use this pattern when:**
- A single standalone button with no popover (just use a button)
- Actions with no shared logic across surfaces (one-off inline handler)

---

## Core Principles

1. **Hook Per Action**: Each action is a hook (`useDeleteActionBarItem`, `usePublishActionBarItem`) returning an `ActionBarItem`
2. **Implicit Content Detection**: `renderContent !== undefined` means the item has a popover — no separate boolean flag
3. **One Popover at a Time**: The `ActionBar` container manages `openKey: string | null`, closing any open popover when another opens
4. **Hook Owns Ref**: Each hook creates its own `triggerRef` — the container applies it to the rendered trigger element
5. **Reusable Renderers**: Shared renderer components (ConfirmRenderer, StarRatingRenderer, PublishMenuRenderer) serve as default `renderContent` implementations, overridable per consumer

---

## Implementation

### ActionBarItem Interface

**File**: `src/types/action-bar.ts`

```typescript
interface ActionBarItem {
  key: string                          // Unique ID for popover orchestration
  icon: LucideIcon
  label: string
  onTrigger?: () => void               // Direct action (no popover)
  renderContent?: (ctx: ActionBarContentContext) => ReactNode  // Popover content
  renderModals?: () => ReactNode       // Always-mounted portaled modals
  onContentClose?: () => void          // Cleanup when popover closes
  triggerRef?: RefObject<HTMLButtonElement | null>  // Hook owns the ref
  loading?: boolean
  disabled?: boolean
  hidden?: boolean
  danger?: boolean
  active?: boolean
  iconClassName?: string               // e.g. 'fill-indigo-400 text-indigo-400'
  to?: string                          // Link variant (renders as <Link>)
  linkParams?: Record<string, string>
  suffix?: ReactNode                   // For MenuItem rendering (e.g. "Coming soon")
}

interface ActionBarContentContext {
  close: () => void
  anchorRef: RefObject<HTMLElement | null>
}
```

**Key decisions**:
- Items with `renderContent` get a Popover; items without get a direct click handler (`onTrigger`)
- Items with `to` render as `<Link>` instead of `<button>`
- Extended return types expose state: hooks return `ActionBarItem & { isDeleted: boolean }` etc.
- `renderModals` is always-mounted (outside popover lifecycle) for modals that need portal rendering

### ActionBar Container

**File**: `src/components/action-bar/ActionBar.tsx`

```typescript
interface ActionBarProps {
  items: ActionBarItem[]
  layout?: 'horizontal' | 'vertical' | 'compact'
  className?: string
}
```

**Behavior**:
1. Filters out `hidden` items
2. Manages `openKey: string | null` — one popover at a time
3. Applies `item.triggerRef` to each trigger element via ref callback
4. Renders triggers as:
   - **horizontal/compact**: Icon buttons (`p-2 text-gray-400 hover:text-white`)
   - **vertical**: MenuItem components (icon + label + suffix)
5. Renders Popover for the active `openKey` item, anchored to its trigger
6. Always renders `item.renderModals?.()` for all items (modals live outside popover)
7. Calls `item.onContentClose?.()` when popover closes
8. Spacing: `gap-1` (horizontal/compact), `space-y-1` (vertical)

### Reusable Renderers

```
src/components/action-bar/renderers/
  ConfirmRenderer.tsx       — Confirm/cancel with variant color
  StarRatingRenderer.tsx    — Wraps StarRating component
  PublishMenuRenderer.tsx   — Multi-step menu (main → submenu → confirm)
```

```typescript
// ConfirmRenderer
interface ConfirmRendererProps {
  text: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  loading?: boolean
  variant?: 'danger' | 'restore'  // Red vs purple button
  close: () => void
}

// StarRatingRenderer
interface StarRatingRendererProps {
  currentRating: number | null
  onRate: (rating: number | null) => void
  close: () => void
}
```

Hooks provide a default `renderContent` using these renderers. Consumers override the whole `renderContent` via hook options if they need different presentation.

### Per-Item Hooks

All in `src/hooks/action-bar/`:

| Hook | Key | Content | Extended State |
|---|---|---|---|
| `useRatingActionBarItem(rating, onRate)` | `rate` | StarRatingRenderer | — |
| `useDeleteActionBarItem(memoryId, isDeleted, opts?)` | `delete` | ConfirmRenderer | `{ isDeleted }` |
| `usePublishActionBarItem(memoryId, opts)` | `publish` | PublishMenuRenderer + modals | — |
| `useShareActionBarItem(entityId, type)` | `share` | None (direct action) | — |
| `useUnlinkActionBarItem(memoryId, relId, onUnlink?)` | `unlink` | ConfirmRenderer | `{ isUnlinked }` |
| `useViewActionBarItem(memories, index)` | `view` | None (direct — lightbox) | — |
| `useCommentActionBarItem(onToggle)` | `comment` | None (direct action) | — |
| `useChatActionBarItem(memoryId, opts)` | `chat` | None (useNavigate internal) | — |
| `useAssignActionBarItem(memoryId)` | `assign` | Modal via renderModals | — |
| `useReportActionBarItem(memoryId, opts)` | `report` | Modal via renderModals | — |

Each hook:
- Creates `const triggerRef = useRef<HTMLButtonElement>(null)`
- Wraps existing shared hooks (`useMemoryDelete`, `useMemoryPublish`) or services
- Provides default `renderContent` using reusable renderers
- Accepts optional `renderContent` override in options for customization

---

## Examples

### Example 1: useDeleteActionBarItem

```typescript
function useDeleteActionBarItem(
  memoryId: string,
  initialDeleted: boolean,
  opts?: {
    onDeleteChange?: (deleted: boolean) => void
    renderContent?: (ctx: ActionBarContentContext) => ReactNode
  },
): ActionBarItem & { isDeleted: boolean } {
  const del = useMemoryDelete(memoryId, initialDeleted, opts?.onDeleteChange)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const defaultRenderContent = useCallback(({ close }: ActionBarContentContext) => (
    <ConfirmRenderer
      text={del.confirmText}
      confirmLabel={del.actionLabel}
      onConfirm={async () => { await del.handleDeleteRestore(); close() }}
      loading={del.deleteLoading}
      variant={del.isDeleted ? 'restore' : 'danger'}
      close={close}
    />
  ), [del])

  return {
    key: 'delete',
    icon: del.isDeleted ? RotateCcw : Trash2,
    label: del.actionLabel,
    renderContent: opts?.renderContent ?? defaultRenderContent,
    triggerRef,
    loading: del.deleteLoading,
    danger: !del.isDeleted,
    isDeleted: del.isDeleted,
  }
}
```

### Example 2: Horizontal Action Bar (MemoryDetailActionBar)

```typescript
function MemoryDetailActionBar(props) {
  const rateItem = useRatingActionBarItem(props.userRating, props.onRate)
  const commentItem = useCommentActionBarItem(props.onCommentToggle)
  const assignItem = useAssignActionBarItem(props.memoryId)
  const shareItem = useShareActionBarItem(props.memoryId, 'memory')
  const publishItem = usePublishActionBarItem(props.memoryId, { ... })
  const deleteItem = useDeleteActionBarItem(props.memoryId, props.isDeleted, { ... })
  const chatItem = useChatActionBarItem(props.memoryId, { ... })
  const reportItem = useReportActionBarItem(props.memoryId, { ... })
  const editItem: ActionBarItem = {
    key: 'edit', icon: Pencil, label: 'Edit', disabled: true,
    suffix: <span className="text-xs text-gray-600">Coming soon</span>,
  }

  return (
    <ActionBar items={[
      rateItem, commentItem, assignItem, shareItem,
      publishItem, editItem, deleteItem, chatItem, reportItem,
    ]} />
  )
}
```

### Example 3: Compact Card Strip (SortableMemoryCard)

```typescript
const viewItem = useViewActionBarItem(allItems, index)
const rateItem = useRatingActionBarItem(userRating, (r) => onRate(memoryId, r))
const unlinkItem = useUnlinkActionBarItem(memoryId, relationshipId, onUnlink)
const deleteItem = useDeleteActionBarItem(memoryId, !!item.deleted_at, {
  renderContent: ({ close }) => (
    <ConfirmRenderer
      text="Delete this memory everywhere?"
      confirmLabel={deleteItem.isDeleted ? 'Restore' : 'Delete'}
      onConfirm={async () => { await del.handleDeleteRestore(); close() }}
      variant={deleteItem.isDeleted ? 'restore' : 'danger'}
      close={close}
    />
  ),
})

const faded = deleteItem.isDeleted || unlinkItem.isUnlinked

return (
  <div className={faded ? 'opacity-20' : ''}>
    {/* card content */}
    <ActionBar items={[viewItem, rateItem, unlinkItem, deleteItem]} layout="compact" />
  </div>
)
```

### Example 4: Vertical Menu (MemoryActions)

```typescript
return (
  <div className="p-4">
    <h3>Settings</h3>
    <ActionBar
      items={[publishItem, shareItem, editItem, deleteItem, chatItem, reportItem, rateItem]}
      layout="vertical"
    />
  </div>
)
```

### Example 5: Link Items (RelationshipDetailActionBar)

```typescript
const reorderItem: ActionBarItem = {
  key: 'reorder',
  icon: LayoutDashboard,
  label: 'Reorder',
  to: '/relationships/$relationshipId/reorder',
  linkParams: { relationshipId },
}
const shareItem = useShareActionBarItem(relationshipId, 'relationship')

return <ActionBar items={[reorderItem, shareItem]} />
```

### Example 6: Inline Static Items

For one-off actions that don't need a hook:

```typescript
const copyItem: ActionBarItem = {
  key: 'copy',
  icon: Copy,
  label: 'Copy link',
  onTrigger: () => {
    navigator.clipboard.writeText(url)
    toast.success({ title: 'Copied!' })
  },
}
```

---

## Anti-Patterns

### Duplicating Action Logic Across Consumers

```typescript
// Bad: Every consumer reimplements delete state + handler + confirmation
function MemoryDetailActionBar() {
  const [isDeleted, setIsDeleted] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const handleDelete = async () => { /* 20 lines */ }
  // ... popover state, anchor ref, confirmation UI
}

function MemoryActions() {
  const [isDeleted, setIsDeleted] = useState(false)  // Same logic again
  // ...
}

// Good: Hook encapsulates everything, container handles popover
const deleteItem = useDeleteActionBarItem(memoryId, isDeleted)
return <ActionBar items={[deleteItem]} />
```

### Managing Popover State Per Consumer

```typescript
// Bad: Every consumer manages openKey + one-at-a-time logic
const [openPopover, setOpenPopover] = useState<string | null>(null)
const rateRef = useRef(null)
const deleteRef = useRef(null)
// ... 30 lines of popover orchestration per consumer

// Good: ActionBar container handles all orchestration
<ActionBar items={[rateItem, deleteItem, publishItem]} />
```

### Per-Prop Customization

```typescript
// Bad: Adding confirmText, confirmLabel, variant props to the hook
useDeleteActionBarItem(id, false, { confirmText: 'Custom text', variant: 'warning' })

// Good: Override the entire renderContent with a reusable renderer
useDeleteActionBarItem(id, false, {
  renderContent: ({ close }) => (
    <ConfirmRenderer text="Custom text" confirmLabel="OK" variant="danger"
      onConfirm={handleDelete} close={close} />
  ),
})
```

---

## Key Design Decisions

### Interface

| Decision | Choice | Rationale |
|---|---|---|
| Content detection | Implicit (`renderContent !== undefined`) | Simpler, less API surface |
| Content context | `{ close, anchorRef }` | No containerType needed — always Popover |
| State exposure | Extended return types per hook | Type-safe, no casting |
| Trigger ref ownership | Hook creates ref, container applies it | Simpler lifecycle |
| Customization | `renderContent` override + reusable renderers | No per-prop customization; renderers compose |

### Container

| Decision | Choice | Rationale |
|---|---|---|
| Content rendering | Always Popover, all layouts | One rendering strategy |
| Sub-menu navigation | Inside `renderContent` only | Nested item lists too complex for container |
| Popover position | Delegate to Popover auto-flip | Container doesn't need layout-aware positioning |

### Hooks

| Decision | Choice | Rationale |
|---|---|---|
| Location | `src/hooks/action-bar/` | Grouped by concern |
| Naming | `use{Action}ActionBarItem` | Explicit, discoverable |
| Publish modals | Inside hook via `renderModals` | Encapsulates modal lifecycle |

---

## Dependencies

- `useMemoryDelete` hook (`src/hooks/useMemoryDelete.ts`)
- `useMemoryPublish` hook (`src/hooks/useMemoryPublish.ts`)
- `Popover` component (`src/components/Popover.tsx`)
- `MenuItem` component (`src/components/MenuItem.tsx`)
- `StarRating` component (`src/components/memories/StarRating.tsx`)
- `PublishModal`, `RetractModal`, `ReportModal`, `RelationshipAssignModal` (all exist)

---

## Checklist

- [ ] Each action is a hook returning `ActionBarItem` — no inline action logic in consumers
- [ ] Hook creates its own `triggerRef` — container applies it
- [ ] `renderContent` uses reusable renderers as building blocks
- [ ] `renderModals` is always-mounted for portal-based modals
- [ ] Extended state (isDeleted, isUnlinked) exposed via typed return
- [ ] ActionBar container manages `openKey` for one-popover-at-a-time
- [ ] Static/one-off items defined as plain objects (no hook needed)
- [ ] Items with `to` render as `<Link>`, not `<button>`

---

## Related Patterns

- **[Modal](./tanstack-cloudflare.modal.md)**: ConfirmationModal used by ConfirmRenderer
- **[Toast System](./tanstack-cloudflare.toast-system.md)**: useActionToast used inside action hooks
- **[Card & List](./tanstack-cloudflare.card-and-list.md)**: Cards consume ActionBar in compact layout

---

**Status**: Specification (not yet implemented — planned for M84)
**Recommendation**: Implement per-item hooks first, then ActionBar container, then migrate consumers one at a time
**Last Updated**: 2026-03-14
**Contributors**: Community
