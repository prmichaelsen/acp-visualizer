# Toast System

**Category**: Design
**Applicable To**: All success/error/warning/info feedback for user actions
**Status**: Stable

---

## Overview

The toast system wraps `@prmichaelsen/pretty-toasts` with two hooks: `useToast` for direct toast calls and `useActionToast` for wrapping async operations with automatic success/error feedback. Toasts render at z-60 (above modals) via a `StandaloneToastContainer` in the root layout.

---

## Implementation

### useToast (Direct Toasts)

**File**: `src/hooks/useToast.ts`

```typescript
const toast = useToast()

toast.success({ title: 'Saved!', message: 'Your changes have been saved.' })
toast.error({ title: 'Failed', message: 'Could not save changes.' })
toast.warning({ title: 'Warning', message: 'This action is irreversible.' })
toast.info({ title: 'Info', message: 'New version available.' })
```

**Toast Options**:

```typescript
interface ToastOptions {
  title: string
  message?: string
  duration?: number  // default: 2500ms
}
```

### useActionToast (Async Action Wrapper)

**File**: `src/hooks/useActionToast.ts`

```typescript
const { withToast } = useActionToast()

const result = await withToast(
  async () => {
    await SomeService.doThing()
    return { id: '123' }
  },
  {
    success: { title: 'Done!', message: 'Thing completed.' },
    error: { title: 'Failed', message: 'Could not do thing.' },
  }
)
// result is the action's return value on success, undefined on error
```

**Behavior**:
- Calls the async action
- On success: shows success toast, returns action result
- On error: shows error toast, returns `undefined`
- No try/catch needed at call site

### Root Layout Integration

**File**: `src/routes/__root.tsx`

```typescript
<ToastProvider>
  <AuthProvider>
    {/* ... all other providers ... */}
    {children}
  </AuthProvider>
  <StandaloneToastContainer />  {/* z-60, above modals */}
</ToastProvider>
```

---

## Examples

### Inline Action with Toast

```typescript
const handleDelete = async () => {
  await withToast(
    () => MemoryService.deleteMemory(memoryId),
    {
      success: { title: 'Deleted', message: 'Memory moved to trash.' },
      error: { title: 'Delete failed' },
    }
  )
}
```

### Direct Toast for Non-Async Feedback

```typescript
const handleCopy = () => {
  navigator.clipboard.writeText(url)
  toast.success({ title: 'Copied!', message: 'Link copied to clipboard.' })
}
```

---

## Anti-Patterns

### Manual Try/Catch + Toast

```typescript
// Bad: Verbose boilerplate
try {
  await SomeService.doThing()
  toast.success({ title: 'Done!' })
} catch (err) {
  toast.error({ title: 'Failed', message: err.message })
}

// Good: Use withToast
await withToast(() => SomeService.doThing(), {
  success: { title: 'Done!' },
  error: { title: 'Failed' },
})
```

---

## Checklist

- [ ] Use `withToast` for all async user actions (save, delete, publish, etc.)
- [ ] Use `toast.success/error` directly for synchronous feedback (copy, toggle)
- [ ] Toast container is rendered once in root layout (not per-component)
- [ ] Keep toast messages concise — title is required, message is optional

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
