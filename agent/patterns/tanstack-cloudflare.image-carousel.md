# Image Carousel

**Category**: Design
**Applicable To**: Horizontal image galleries in chat messages, profiles, and any scrollable media strip
**Status**: Stable

---

## Overview

A CSS scroll-snap carousel with IntersectionObserver-based visibility tracking, lazy loading, scale/opacity interpolation per slide, keyboard navigation, and responsive dot/counter navigation. Used for chat message image galleries, memory card carousels, and profile media.

---

## Implementation

### ImageCarousel

**File**: `src/components/ImageCarousel.tsx`

```typescript
interface ImageCarouselProps {
  images: Array<{ src: string; alt?: string; crop?: CropData | null }>
  onImageClick?: (index: number) => void  // Opens lightbox
}
```

**Core Mechanics**:

1. **CSS Scroll-Snap**:
   ```typescript
   <div className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
     {images.map((img, i) => (
       <div key={i} className="flex-shrink-0 w-full snap-center">
         <img src={img.src} />
       </div>
     ))}
   </div>
   ```

2. **IntersectionObserver** (21-step threshold: 0/20 to 20/20):
   - Tracks per-slide visibility ratio (0.0 to 1.0)
   - Updates `slideVisibility` array on each intersection change
   - Most-visible slide becomes `currentIndex`

3. **Scale/Opacity Interpolation**:
   ```typescript
   const ratio = slideVisibility[i] ?? 0
   const scale = 0.92 + 0.08 * ratio        // 92% → 100%
   const opacity = 0.4 + 0.6 * ratio        // 40% → 100%
   ```

4. **Lazy Loading**:
   - `loadedIndices` Set tracks rendered slides
   - Preloads current ± 1 adjacent slides
   - Unloaded slides render placeholder (prevents layout shift)

5. **Navigation UI**:
   - **Dots**: For ≤7 slides, dot indicators at bottom (active = white, inactive = gray)
   - **Counter**: For >7 slides, text "3 / 10"
   - **Chevrons**: Desktop only (`hidden md:flex`), hidden at boundaries

6. **Keyboard**: ArrowLeft/ArrowRight scrolls to adjacent slide

**Touch Direction Detection** (MemoryCardCarousel variant):
```typescript
const handleTouchMove = (e: ReactTouchEvent) => {
  const dx = Math.abs(e.touches[0].clientX - touchStart.x)
  const dy = Math.abs(e.touches[0].clientY - touchStart.y)
  // Lock horizontal scroll-snap when horizontal swipe detected
  if (dx > dy * 2) {
    scrollRef.current.style.scrollSnapType = 'x mandatory'
  } else {
    // Disable snap to allow vertical page scroll
    scrollRef.current.style.scrollSnapType = 'none'
  }
}
```

---

## Anti-Patterns

### Using State for Slide Index Instead of IntersectionObserver

```typescript
// Bad: Scroll events are noisy and imprecise
onScroll={(e) => setIndex(Math.round(e.target.scrollLeft / slideWidth))}

// Good: IntersectionObserver provides precise visibility ratios
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    slideVisibility[index] = entry.intersectionRatio
  })
}, { threshold: Array.from({ length: 21 }, (_, i) => i / 20) })
```

### Rendering All Slides Eagerly

```typescript
// Bad: All images load at once
{images.map((img) => <img src={img.src} />)}

// Good: Lazy load with preload ±1
{loadedIndices.has(i) ? <img src={img.src} /> : <div className="bg-gray-800" />}
```

---

## Checklist

- [ ] Use `snap-x snap-mandatory` on scroll container
- [ ] Use `snap-center` on each slide
- [ ] Track visibility with IntersectionObserver (21-step threshold)
- [ ] Lazy-load slides with ±1 preloading
- [ ] Apply scale/opacity interpolation for smooth transitions
- [ ] Show dots for ≤7 slides, counter for >7
- [ ] Hide chevrons on mobile, show only at non-boundary positions
- [ ] Handle touch direction to avoid blocking vertical page scroll

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
