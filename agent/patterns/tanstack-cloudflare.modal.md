# Modal & Confirmation Modal

**Category**: Design
**Applicable To**: All dialog overlays, confirmations, form modals, and persistent consent dialogs
**Status**: Stable

---

## Overview

The Modal system provides a portal-rendered overlay (z-55) with backdrop blur, escape/click-outside dismissal, body scroll lock, and safe-area-inset-top support. ConfirmationModal extends it with variant-colored icons and a two-button confirm/cancel footer. Use `persistent: true` to disable all dismissal paths for consent flows.

---

## Implementation

### Modal (Base)

**File**: `src/components/modals/Modal.tsx`

```typescript
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  style?: React.CSSProperties
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  persistent?: boolean  // Disables Escape, backdrop click, and close button
}
```

**Behavior**:
- `createPortal` to `document.body` at z-index 55
- Backdrop: `bg-black/50 backdrop-blur-sm`, click-outside closes (unless persistent)
- Escape key closes (unless persistent)
- Body scroll lock: `document.body.style.overflow = 'hidden'` on mount, restored on unmount
- Close button (X) top-right, hidden when persistent
- Title rendered above children if provided
- `paddingTop: env(safe-area-inset-top)` on the fixed container
- Backdrop click uses `e.target === e.currentTarget` to avoid closing on content clicks

**Usage**:

```typescript
<Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit Item" maxWidth="md">
  <form>{/* form content */}</form>
</Modal>
```

---

### ConfirmationModal

**File**: `src/components/modals/ConfirmationModal.tsx`

```typescript
interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string | React.ReactNode
  confirmText?: string   // default: "Confirm"
  cancelText?: string    // default: "Cancel"
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
}
```

**Behavior**:
- Built on Modal (sm width)
- Variant-colored gradient icon circle at top:
  - `danger`: purple-pink gradient
  - `warning`: yellow-orange gradient
  - `info`: blue-cyan gradient
- Two-button footer: Cancel (gray) | Confirm (variant gradient)
- Both buttons disabled during `isLoading`
- Prevents modal dismiss during loading: passes `() => {}` as `onClose` to Modal

**Usage**:

```typescript
<ConfirmationModal
  isOpen={showDelete}
  onClose={() => setShowDelete(false)}
  onConfirm={handleDelete}
  title="Delete Memory"
  message="This action cannot be undone."
  confirmText="Delete"
  variant="danger"
  isLoading={deleting}
/>
```

---

### SuccessModal

**File**: `src/components/modals/SuccessModal.tsx`

```typescript
interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: React.ReactNode
}
```

Single "Close" button with blue-cyan gradient. Check icon in gradient circle.

---

## Anti-Patterns

### Rendering Modal Content Without Portal

```typescript
// Bad: Modal renders in component tree, z-index conflicts with parents
<div className="relative z-10">
  <div className="fixed inset-0 bg-black/50">{content}</div>
</div>

// Good: Use Modal component (portals to document.body)
<Modal isOpen={open} onClose={close}>{content}</Modal>
```

### Forgetting isLoading Guard on Dismiss

```typescript
// Bad: User can close modal while async confirm is running
<Modal isOpen={open} onClose={() => setOpen(false)}>
  <button onClick={asyncConfirm}>Confirm</button>
</Modal>

// Good: Disable dismiss during loading
<ConfirmationModal isLoading={loading} onClose={() => setOpen(false)} ... />
// ConfirmationModal internally passes () => {} as onClose when loading
```

---

## Checklist

- [ ] Use `Modal` base for custom dialogs, `ConfirmationModal` for confirm/cancel flows
- [ ] Set `persistent: true` for consent/TOS dialogs that must not be dismissed
- [ ] Set `maxWidth` appropriately (sm for confirms, md-lg for forms, xl-2xl for complex content)
- [ ] Guard dismiss during async operations with `isLoading`
- [ ] Content uses max-h-[90vh] with overflow-auto for long content

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
