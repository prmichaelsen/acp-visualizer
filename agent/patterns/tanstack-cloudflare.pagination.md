# Pagination Suite

**Category**: Design
**Applicable To**: All paginated data display — explicit page controls, infinite scroll, virtualized lists, offset/limit APIs, and view mode toggles
**Status**: Stable

---

## Overview

The pagination suite provides four complementary strategies for navigating large data sets: Paginator (explicit page controls with editable current page), PaginationToggle (paginated vs infinite mode switch with page-size slider), InfiniteScrollSentinel (auto-load on scroll via IntersectionObserver), and react-virtuoso / @tanstack/react-virtual for virtualized rendering. All feed APIs use a consistent offset/limit pattern with `{ items, total, hasMore }` responses.

---

## When to Use This Pattern

| Strategy | When to Use |
|---|---|
| **Paginator** | Discrete page navigation with known total pages (e.g., reorder grid) |
| **PaginationToggle** | User should choose between paginated and infinite modes |
| **Virtuoso `useWindowScroll`** | Page-level feed with infinite scroll (memories, spaces, profiles) |
| **Virtuoso container-scroll** | Fixed-height container with prepend (chat messages) |
| **@tanstack/react-virtual** | Contained scrollable list within a panel (comments) |
| **InfiniteScrollSentinel** | Simple auto-load trigger without full virtualization |
| **FeedList (non-virtualized)** | Small static lists (< ~50 items) with loading/empty/error states |

---

## Core Principles

1. **Offset/Limit API Convention**: All paginated endpoints accept `limit` + `offset` and return `{ items, total, hasMore }`
2. **Clamped Limits**: Server clamps `limit` to `[1, 50]` — client defaults to `PAGE_SIZE = 20`
3. **Offset Ref**: Client tracks current offset in a `useRef` (not state) to avoid stale closures in callbacks
4. **Cache First Pages**: First-page results are cached for instant tab/filter switching; load-more appends are not cached
5. **URL State for Pagination**: Page number, page size, and view mode sync to URL search params via `replaceState`

---

## Implementation

### Paginator (Explicit Page Controls)

**File**: `src/components/Paginator.tsx`

```typescript
interface PaginatorProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Number of sibling page numbers on each side of current (default: 2) */
  siblings?: number
}
```

**Layout**: `|< < 3 4 [X] 5 6 > >|`

- **First/Last**: `ChevronsLeft` / `ChevronsRight` — jump to page 1 or totalPages
- **Prev/Next**: `ChevronLeft` / `ChevronRight` — single page step
- **Siblings**: Clickable page numbers ±`siblings` from current
- **Editable current page**: Gradient input (`from-purple-600 to-blue-600`)
  - Auto-selects on focus
  - Enter commits, Escape reverts, blur commits
  - `inputMode="numeric"` for mobile keyboards
  - Value clamped to `[1, totalPages]`
- **Hidden**: Returns `null` if `totalPages <= 1`
- **Accessibility**: `aria-label` on all buttons and input

---

### PaginationToggle (Mode Switch + Page Size)

**File**: `src/components/reorder/PaginationToggle.tsx`

```typescript
interface PaginationToggleProps {
  viewMode: 'infinite' | 'paginated'
  onViewModeChange: (mode: 'infinite' | 'paginated') => void
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
}
```

**Features**:
- **View mode pills**: "Pages" | "Infinite" toggle buttons
  - Active: gradient `from-purple-600 to-blue-600` with shadow
  - Inactive: gray with hover
- **Paginated mode shows**:
  - Page size slider (discrete options: `[5, 50, 70, 100]`) with "Per page: N" label
  - Paginator component for page navigation
- **Page size change resets to page 1**

**Usage**:

```typescript
<PaginationToggle
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  pageSize={pageSize}
  onPageSizeChange={(size) => {
    setPageSize(size)
    setCurrentPage(1)  // Reset on size change
  }}
/>
```

---

### InfiniteScrollSentinel (Auto-Load Trigger)

**File**: `src/components/feed/InfiniteScrollSentinel.tsx`

```typescript
interface InfiniteScrollSentinelProps {
  hasMore: boolean
  loading: boolean
  onLoadMore: () => void
}
```

**Implementation**:
- Renders a sentinel `<div>` (h-4) watched by IntersectionObserver (threshold: 0.1)
- Triggers `onLoadMore` when sentinel becomes 10% visible AND `hasMore && !loading`
- Shows `<Loader2 animate-spin>` during loading
- Place at the bottom of a scrollable list

**Usage**:

```typescript
{memories.map(m => <MemoryCard key={m.id} memory={m} />)}
<InfiniteScrollSentinel hasMore={hasMore} loading={loadingMore} onLoadMore={() => loadFeed(false)} />
```

---

### Virtuoso (react-virtuoso) — Feed & Chat Patterns

#### Pattern A: Window-Scroll Feed

Used by: memories, SpacesFeed, ProfileMemoriesFeed, GroupMemories

```typescript
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  useWindowScroll
  data={memories}
  endReached={() => {
    if (hasMore && !loading && !loadingMore) {
      loadFeed(false)
    }
  }}
  itemContent={(index, memory) => (
    <div className="pb-2">
      <MemoryCard memory={memory} />
    </div>
  )}
  components={{
    Footer: () => loadingMore ? (
      <div className="flex justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    ) : null,
  }}
/>
```

#### Pattern B: Container-Scroll Chat (Prepend)

Used by: MessageList

```typescript
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

const INITIAL_INDEX = 100_000
const virtuosoRef = useRef<VirtuosoHandle>(null)
const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_INDEX - items.length)

// Update firstItemIndex when items prepend
useEffect(() => {
  setFirstItemIndex(INITIAL_INDEX - items.length)
}, [items.length])

<Virtuoso
  ref={virtuosoRef}
  className="flex-grow h-0"
  firstItemIndex={firstItemIndex}
  initialTopMostItemIndex={items.length - 1}
  data={items}
  startReached={() => {
    if (!isLoadingMore && hasMore && onLoadMore) {
      setIsLoadingMore(true)
      onLoadMore()
    }
  }}
  itemContent={(index, item) => <Message ... />}
/>

// Programmatic scroll
virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })
```

#### Pattern C: @tanstack/react-virtual (Container Panel)

Used by: CommentSection

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: comments.length,
  getScrollElement: () => scrollContainerRef.current,
  estimateSize: () => 160,
  overscan: 10,
})

// Manual scroll detection for load-more
const handleScroll = () => {
  const el = scrollContainerRef.current
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  if (distFromBottom < 100 && hasMore && !loadingMore) loadMore()
}

// Programmatic scroll
virtualizer.scrollToIndex(index, { align: 'start' })
```

---

### Offset/Limit API Convention

All paginated endpoints follow this pattern:

**Request**:
```
GET /api/spaces/feed?limit=20&offset=0&algorithm=smart&query=AI
```

**Response**:
```typescript
{
  memories: MemoryItem[]      // The page of results
  total: number               // Total matching items
  hasMore: boolean            // Whether more pages exist
  limit: number               // Echoed back
  offset: number              // Echoed back
  maps?: {
    profiles: Record<string, UserProfile>  // Profile enrichment
  }
}
```

**Server-side clamping**:
```typescript
const limit = Math.min(Math.max(parsedLimit || 20, 1), 50)  // Clamp to [1, 50]
const offset = Math.max(parsedOffset || 0, 0)
const hasMore = offset + results.length < total
```

---

### Client-Side Data Fetching Pattern

```typescript
const PAGE_SIZE = 20
const offsetRef = useRef(0)
const [memories, setMemories] = useState<MemoryItem[]>([])
const [loading, setLoading] = useState(false)
const [loadingMore, setLoadingMore] = useState(false)
const [hasMore, setHasMore] = useState(false)

const loadFeed = useCallback(async (reset: boolean) => {
  const currentOffset = reset ? 0 : offsetRef.current

  if (reset) {
    setLoading(true)
    setMemories([])
    offsetRef.current = 0
  } else {
    setLoadingMore(true)
  }

  try {
    const result = await FeedService.getFeed({
      limit: PAGE_SIZE,
      offset: currentOffset,
      // ... filters
    })

    const newItems = result.memories ?? []
    setMemories(prev => reset ? newItems : [...prev, ...newItems])
    setHasMore(result.hasMore ?? false)
    offsetRef.current = currentOffset + newItems.length

    // Cache first page for instant tab switching
    if (reset) {
      cache.set(cacheKey, { memories: newItems, total: result.total, hasMore: result.hasMore })
    }
  } finally {
    setLoading(false)
    setLoadingMore(false)
  }
}, [filters])
```

**Key details**:
- `offsetRef` (not state) avoids stale closure issues in `endReached` / `loadFeed` callbacks
- Reset clears items and resets offset to 0
- Append keeps existing items and advances offset
- Only first-page (reset) results are cached

---

### URL State Sync

```typescript
useEffect(() => {
  const url = new URL(window.location.href)
  if (viewMode === 'paginated') {
    url.searchParams.set('mode', 'pages')
    url.searchParams.set('page', String(currentPage))
    if (pageSize !== DEFAULT_PAGE_SIZE) {
      url.searchParams.set('pageSize', String(pageSize))
    } else {
      url.searchParams.delete('pageSize')
    }
  } else {
    url.searchParams.delete('mode')
    url.searchParams.delete('page')
    url.searchParams.delete('pageSize')
  }
  window.history.replaceState(null, '', url.toString())
}, [currentPage, viewMode, pageSize])
```

---

## Anti-Patterns

### Using State Instead of Ref for Offset

```typescript
// Bad: Stale closure — endReached captures old offset value
const [offset, setOffset] = useState(0)
endReached={() => loadFeed(offset)}  // offset is stale!

// Good: Ref always has current value
const offsetRef = useRef(0)
endReached={() => loadFeed(offsetRef.current)}
```

### Unbounded API Queries

```typescript
// Bad: No limit — could return thousands of documents
const result = await fetch('/api/feed')

// Good: Always pass limit, server clamps to [1, 50]
const result = await fetch('/api/feed?limit=20&offset=0')
```

### Not Resetting Page on Filter Change

```typescript
// Bad: Page 5 of old filter shows empty results
setAlgorithm('recent')
// currentPage still 5, but 'recent' might only have 3 pages

// Good: Reset to page 1 on any filter change
setAlgorithm('recent')
setCurrentPage(1)
```

### Caching Load-More Results

```typescript
// Bad: Cache includes appended pages — stale on next visit
cache.set(key, { memories: allLoadedMemories })

// Good: Only cache first-page results
if (reset) {
  cache.set(key, { memories: firstPageMemories, total, hasMore })
}
```

---

## Key Design Decisions

### Architecture

| Decision | Choice | Rationale |
|---|---|---|
| API pagination style | Offset/limit (not cursor) | Simpler; works with Firestore's `startAfter` |
| Server limit clamp | [1, 50] | Prevents abuse; 50 is enough for any page |
| Client default page size | 20 | Good balance between load time and content density |
| Offset tracking | `useRef` (not state) | Avoids stale closures in scroll callbacks |
| First-page caching | Cache only reset fetches | Prevents stale data from cached load-more appends |

### Component Selection

| Decision | Choice | Rationale |
|---|---|---|
| Feed virtualization | react-virtuoso | Best window-scroll support, prepend support for chat |
| Panel virtualization | @tanstack/react-virtual | Lighter weight for contained panels |
| Simple lists | FeedList (no virtualization) | < 50 items don't need virtual DOM overhead |
| Auto-load trigger | IntersectionObserver sentinel | No scroll listener needed; clean observer API |

---

## Checklist

- [ ] API endpoints clamp limit to `[1, 50]` and return `{ items, total, hasMore }`
- [ ] Client tracks offset in `useRef`, not `useState`
- [ ] Only first-page (reset) results are cached; load-more appends are not
- [ ] Page/filter changes reset offset to 0 and clear existing items
- [ ] Paginator returns `null` when `totalPages <= 1`
- [ ] PaginationToggle resets to page 1 when page size changes
- [ ] Virtuoso feeds use `useWindowScroll` for page-level scroll
- [ ] Virtuoso chat uses `firstItemIndex` pattern for stable prepend
- [ ] InfiniteScrollSentinel placed at list bottom with `hasMore` + `loading` guards
- [ ] Pagination state synced to URL via `replaceState` for deep-linkability

---

## Related Patterns

- **[Card & List](./tanstack-cloudflare.card-and-list.md)**: FeedList for non-virtualized lists, Virtuoso usage details
- **[Form Controls](./tanstack-cloudflare.form-controls.md)**: Slider component used in PaginationToggle for page size
- **[SSR Preload](./ssr-preload.md)**: Server-side first-page preload seeds the Virtuoso data array
- **[Feed State Preservation](./local.feed-state-preservation.md)**: FeedCacheContext preserves feed state across navigation

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
