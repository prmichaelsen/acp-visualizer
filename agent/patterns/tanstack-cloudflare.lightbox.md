# LightboxContainer & ImageLightbox

**Category**: Design
**Applicable To**: Full-screen image galleries, memory detail viewers, crop editors, and any swipeable full-screen overlay
**Status**: Stable

---

## Overview

LightboxContainer is a reusable full-screen shell (portal, z-55) with slide animation, keyboard/swipe navigation, and a counter badge. ImageLightbox extends it for image galleries with crop data, lazy preloading, and scaled previews. Other lightboxes (MemoryLightbox, ImageCropLightbox) also build on LightboxContainer.

---

## Implementation

### LightboxContainer (Shell)

**File**: `src/components/LightboxContainer.tsx`

```typescript
interface LightboxContainerProps {
  totalCount: number
  index: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  navDisabled?: boolean              // Disable keyboard/swipe nav (e.g., during crop edit)
  onEscapeWhileNavDisabled?: () => void   // Escape exits sub-mode, not lightbox
  onBackdropClickWhileNavDisabled?: () => void
  children: ReactNode                // The slide content
  overlay?: ReactNode                // Non-animated toolbar/controls
  animatedClassName?: string         // Extra classes on the animated content div
}
```

**Features**:
- Portal to `document.body`, z-55, `bg-black/90 backdrop-blur-sm`
- Body scroll lock + safe-area-inset-top
- **Slide animation**: 200ms ease-out, scale(0.92) + translateX(±60px) on exit/enter
- **Keyboard**: ArrowLeft/Right for prev/next, Escape to close
- **Touch/swipe**: Horizontal >100px = nav, vertical up >80px from backdrop = dismiss
- **Navigation UI**: Chevron buttons (hidden on mobile), counter badge at bottom ("3 / 10")
- Close button (X) top-right with safe-area offset

**Gesture Detection**:

```typescript
// Horizontal swipe: navigate
if (deltaX > 100 && absX > absY) onPrev()
if (deltaX < -100 && absX > absY) onNext()
// Vertical swipe up from backdrop: dismiss
if (onBackdrop && deltaY < -80 && absY > absX) onClose()
```

**Usage** (building a custom lightbox):

```typescript
function MyLightbox({ items, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  return (
    <LightboxContainer
      totalCount={items.length}
      index={index}
      onPrev={() => setIndex(i => Math.max(0, i - 1))}
      onNext={() => setIndex(i => Math.min(items.length - 1, i + 1))}
      onClose={onClose}
    >
      <MySlideContent item={items[index]} />
    </LightboxContainer>
  )
}
```

---

### ImageLightbox (Gallery Viewer)

**File**: `src/components/ImageLightbox.tsx`

```typescript
interface ImageLightboxProps {
  images: Array<{ src: string; alt?: string; crop?: CropData | null }>
  startIndex: number
  onClose: () => void
}
```

**Features**:
- Built on LightboxContainer
- Lazy-loads crop data via HEAD request to image proxy (module-level cache)
- Preloads adjacent images (current ± 1) to eliminate flash
- ScaledCropPreview: uses CSS `background-position` + `background-size` for efficient cropped display
- Max constraints: 95vw width, 85vh height
- Click-stop propagation on images (prevents backdrop close)

---

### ImageCropLightbox (Crop Editor)

**File**: `src/components/ImageCropLightbox.tsx`

```typescript
interface ImageCropLightboxProps {
  images: CropImage[]
  startIndex: number
  onClose: () => void
  onCropChange?: (index: number, crop: CropData) => void
}
```

**Features**:
- Built on LightboxContainer with `navDisabled` during active crop
- Toggle between view mode and crop mode (Escape exits crop mode, not lightbox)
- Overlay buttons: crop toggle, reset crop
- Lazy-loads natural image dimensions for proper crop calculations

---

## Anti-Patterns

### Building Full-Screen Overlays Without LightboxContainer

```typescript
// Bad: Reimplementing swipe, keyboard, animation, scroll lock
<div className="fixed inset-0 z-50" onKeyDown={handleKey}>
  {/* Custom implementation */}
</div>

// Good: Use LightboxContainer for the shell
<LightboxContainer totalCount={n} index={i} onPrev={prev} onNext={next} onClose={close}>
  {/* Just the slide content */}
</LightboxContainer>
```

### Forgetting navDisabled for Sub-Modes

```typescript
// Bad: User swipes during crop edit, navigates away and loses changes
<LightboxContainer onPrev={prev} onNext={next}>
  <CropEditor />
</LightboxContainer>

// Good: Disable nav during sub-mode
<LightboxContainer
  navDisabled={cropActive}
  onEscapeWhileNavDisabled={() => setCropActive(false)}
  onBackdropClickWhileNavDisabled={() => setCropActive(false)}
>
  <CropEditor />
</LightboxContainer>
```

---

## Checklist

- [ ] Use LightboxContainer for any full-screen gallery or detail viewer
- [ ] Set `navDisabled` when entering a sub-mode (crop, edit, etc.)
- [ ] Provide `onEscapeWhileNavDisabled` to exit sub-mode on Escape
- [ ] Preload adjacent slides to eliminate flash on navigation
- [ ] Apply `e.stopPropagation()` on interactive content to prevent backdrop close
- [ ] Safe-area-inset-top applied via inline style

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
