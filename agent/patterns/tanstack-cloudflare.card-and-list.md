# Card, NotificationCard & CardList

**Category**: Design
**Applicable To**: All card-based data display, notification items with swipe-to-dismiss, and generic feed/list rendering
**Status**: Stable

---

## Overview

Cards are the primary data display unit across the app. This pattern covers the standard card styling, NotificationCard with swipe-to-dismiss gesture, and CardList (FeedList) — a generic list component that handles loading skeletons, empty states, and error banners for any card type.

---

## Implementation

### Card (Standard Styling)

All cards in the app follow consistent styling:

```typescript
// Standard card container
<div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4">
  {/* Card content */}
</div>

// With hover effect
<div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4
                hover:border-blue-500/50 transition-colors cursor-pointer">
  {/* Clickable card */}
</div>

// Highlighted/active
<div className="bg-purple-900/20 border border-purple-400/60 rounded-xl p-4 shadow-purple-500/10">
  {/* Active card */}
</div>
```

**Text Hierarchy**:
- Title: `text-white font-semibold`
- Subtitle/secondary: `text-gray-400 text-sm`
- Meta/timestamp: `text-gray-500 text-xs`

**Action Buttons** (icon buttons within cards):
- Base: `p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors`
- Danger: `text-red-400 hover:text-red-300`
- Disabled: `opacity-50 cursor-not-allowed`

**State Variants**:
- Deleted/faded: `opacity-20 transition-opacity duration-200`
- Loading: `animate-pulse bg-gray-800`

---

### NotificationCard

**File**: `src/components/notifications/NotificationCard.tsx`

```typescript
interface NotificationCardProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onOpenFriendRequest?: (notification: Notification) => void
}
```

**Features**:
- Unread indicator: blue dot (w-2 h-2) on left side
- Avatar circle (w-10 h-10) or type-specific icon with colored background
- Content: title (truncated), message (line-clamp-2), relative timestamp
- Message count badge (top-right, blue pill)
- **Swipe-to-dismiss**: horizontal swipe >80px threshold
  - Reveal background: `bg-blue-600/30`
  - Smooth dismiss animation (300ms translateX)
  - Calls `onMarkAsRead` on dismiss
- Type-specific icons: `friend_request`, `friend_accepted`, `group_invite`, `new_message`, `system`, `memory_published`, `memory_comment`, `organize_nudge`

---

### CardList (Generic Feed Primitive)

**File**: `src/components/feed/FeedList.tsx`

```typescript
interface CardListProps<T> {
  items: T[]
  loading: boolean
  error: string | null
  renderItem: (item: T, index: number) => ReactNode
  emptyIcon: ReactNode
  emptyMessage: string
  skeletonCount?: number  // default: 4
}

export function FeedList<T>({ items, loading, error, renderItem, emptyIcon, emptyMessage, skeletonCount = 4 }: CardListProps<T>) {
  // Error state: red banner
  if (error) return <div className="text-red-400 p-4 ...">{error}</div>

  // Loading state: skeleton cards
  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div key={i} className="bg-gray-800 rounded-xl h-32 animate-pulse" />
      ))}
    </div>
  )

  // Empty state: centered icon + message
  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      {emptyIcon}
      <p className="mt-2">{emptyMessage}</p>
    </div>
  )

  // Items
  return <div className="space-y-2">{items.map(renderItem)}</div>
}
```

**Usage**:

```typescript
<FeedList
  items={conversations}
  loading={loading}
  error={error}
  renderItem={(conv, i) => <ConversationCard key={conv.id} conversation={conv} />}
  emptyIcon={<MessageSquare className="w-12 h-12 text-gray-600" />}
  emptyMessage="No conversations yet"
  skeletonCount={6}
/>
```

---

### Virtualized Lists (react-virtuoso)

For feeds with many items, use `react-virtuoso` instead of mapping all items to DOM. Two usage patterns exist:

#### Pattern A: Window-Scroll Feed (Memories, Spaces, Groups, Profiles)

Used for page-level feeds where the entire page scrolls. `useWindowScroll` delegates scrolling to the browser window.

```typescript
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  useWindowScroll
  data={memories}
  endReached={() => {
    if (hasMore && !loading && !loadingMore) {
      loadFeed(false)  // Append next page
    }
  }}
  itemContent={(index, memory) => (
    <div className="pb-2">
      <MemoryCard memory={memory} source={source} />
    </div>
  )}
  components={{
    Footer: () =>
      loadingMore ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : null,
  }}
/>
```

**Key props**:
- `useWindowScroll`: Scroll container is the browser window, not Virtuoso's own div
- `data`: The array of items to render
- `endReached`: Callback when user scrolls to the bottom — trigger load-more
- `itemContent`: Render function per item (wraps card in `pb-2` for gap)
- `components.Footer`: Loading spinner while fetching next page

**Used in**: `/memories`, `SpacesFeed`, `ProfileMemoriesFeed`, `GroupMemories`

#### Pattern B: Container-Scroll Chat (MessageList)

Used for chat where messages prepend from the top and the container has a fixed height.

```typescript
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

const virtuosoRef = useRef<VirtuosoHandle>(null)

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

// Programmatic scroll to bottom
virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' })
```

**Key props**:
- `firstItemIndex`: Enables stable prepend — set to a large number minus item count, decrement as older messages load
- `initialTopMostItemIndex`: Start at bottom (`items.length - 1`)
- `startReached`: Callback when user scrolls to the top — load older messages
- `ref` (`VirtuosoHandle`): Exposes `scrollToIndex` for programmatic scroll (new message arrival, search result navigation)

**Used in**: `MessageList`

#### When to Use Each

| Pattern | When | Scroll Container |
|---|---|---|
| FeedList (non-virtualized) | < ~50 items, simple lists | Parent div |
| Virtuoso `useWindowScroll` | Feed pages with infinite scroll | Browser window |
| Virtuoso container-scroll | Chat with prepend, fixed height | Virtuoso div |

---

## Anti-Patterns

### Inconsistent Card Styling

```typescript
// Bad: Custom card styling that doesn't match the system
<div className="bg-white rounded-md p-2 shadow">{content}</div>

// Good: Use standard card classes
<div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4">
  {content}
</div>
```

### Reimplementing Loading/Empty/Error States

```typescript
// Bad: Custom loading/empty per page
{loading ? <Spinner /> : items.length === 0 ? <p>Empty</p> : items.map(...)}

// Good: Use CardList/FeedList
<FeedList items={items} loading={loading} error={error}
  renderItem={(item) => <MyCard item={item} />}
  emptyIcon={<Icon />} emptyMessage="Nothing here" />
```

---

## Checklist

- [ ] Cards use `bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4`
- [ ] Text hierarchy follows: white (title), gray-400 (subtitle), gray-500 (meta)
- [ ] Use `FeedList` for small static lists with loading/empty/error states
- [ ] Use `Virtuoso` with `useWindowScroll` for feed pages with infinite scroll
- [ ] Use `Virtuoso` container-scroll with `firstItemIndex` for chat-style prepend lists
- [ ] Wrap each Virtuoso item in `<div className="pb-2">` for consistent card gap
- [ ] Provide `components.Footer` with loading spinner for load-more feedback
- [ ] Swipe-to-dismiss uses 80px threshold with reveal background
- [ ] Deleted/faded items use `opacity-20` transition

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
