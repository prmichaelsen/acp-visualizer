# SlideOverPanel & MessageSearchSlideover

**Category**: Design
**Applicable To**: Right-side slide panels, search slideouts, and configuration drawers
**Status**: Stable

---

## Overview

SlideOverPanel is a lightweight right-side drawer (w-72) that slides in with a translate-x animation and backdrop. MessageSearchSlideover is a specialized full-width search panel with debounced API search and result navigation. Both render inline (not portaled) with fixed positioning.

---

## Implementation

### SlideOverPanel (Generic Drawer)

**File**: `src/components/SlideOverPanel.tsx`

```typescript
interface SlideOverPanelProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}
```

**Behavior**:
- Fixed positioning: `top-14` (below header), `right-0`, `bottom-0`
- Width: `w-72` (288px)
- **Not** a portal — renders inline from parent component
- **Animation** (200ms):
  - Backdrop: `opacity-0` → `opacity-100`
  - Panel: `translate-x-full` → `translate-x-0`
- Mounted/visible state tracking for exit animation before unmount
- Backdrop click closes
- z-index: backdrop 20, panel 30
- Dark theme: `bg-gray-900` with `border-l border-gray-800`

**Usage**:

```typescript
<SlideOverPanel open={panelOpen} onClose={() => setPanelOpen(false)}>
  <div className="p-4">
    <h3>Panel Content</h3>
    {/* configuration, details, etc. */}
  </div>
</SlideOverPanel>
```

---

### MessageSearchSlideover (Search Panel)

**File**: `src/components/chat/MessageSearchSlideover.tsx`

```typescript
interface MessageSearchSlideoverProps {
  conversationId: string
  isOpen: boolean
  onClose: () => void
  onSelectMessage: (messageId: string) => void
}
```

**Behavior**:
- Full-screen fixed panel (not constrained to right side)
- Max-width: `md` on desktop
- **Header**: Search icon + auto-focused input + X close button
- **Debounced search**: 300ms delay, calls `/api/search/messages`
- **Results**: Message snippet with fade mask, role label, relative time
- Click result → calls `onSelectMessage(messageId)` and closes panel
- Escape key closes
- Backdrop click closes
- Safe-area-inset-top handling

**Usage**:

```typescript
<MessageSearchSlideover
  conversationId={conversationId}
  isOpen={searchOpen}
  onClose={() => setSearchOpen(false)}
  onSelectMessage={(id) => scrollToMessage(id)}
/>
```

---

## Anti-Patterns

### Using Portal for Simple Slide Panels

```typescript
// Bad: Unnecessary portal when parent layout supports fixed children
{createPortal(<div className="fixed right-0">...</div>, document.body)}

// Good: Render inline — simpler and avoids portal context issues
<SlideOverPanel open={open} onClose={close}>{content}</SlideOverPanel>
```

### Not Auto-Focusing Search Input

```typescript
// Bad: User must click into input after opening
<input type="text" />

// Good: Auto-focus on open
const inputRef = useRef<HTMLInputElement>(null)
useEffect(() => { if (isOpen) inputRef.current?.focus() }, [isOpen])
```

---

## Checklist

- [ ] Use `SlideOverPanel` for generic right-side drawers
- [ ] Use `MessageSearchSlideover` for search-within-conversation
- [ ] Auto-focus input when panel opens
- [ ] Debounce search input (300ms)
- [ ] Panel renders below header (`top-14`) to avoid overlapping
- [ ] Exit animation completes before unmount (mounted/visible state tracking)

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
