# SSR Data Preloading Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications requiring server-side rendering
**Status**: Stable

---

## Overview

This pattern demonstrates how to preload data on the server using TanStack Router's `beforeLoad` hook, pass it through route context, and hydrate components with SSR data to eliminate loading flashes. By fetching data server-side before the page renders, you provide instant content to users and search engines while maintaining the ability to add real-time updates via WebSockets.

The pattern ensures that users never see loading spinners on initial page load, improving perceived performance and providing better SEO since search engines can index the fully-rendered content.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building TanStack Start applications with Cloudflare Workers
- Any data can be fetched server-side (Firestore, database, API)
- Working with user-specific data (we use server-side auth, never client-side)
- Need to eliminate loading spinners on initial page load
- Want better SEO (search engines can index the content)
- Improving perceived performance is important
- Working with real-time data (SSR provides initial state, WebSocket adds updates)

❌ **Don't use this pattern when:**
- Data is too large (>500KB) and would slow down SSR
- Data fetch is extremely slow (>3 seconds) and would block page load
- Data is purely client-side (localStorage, IndexedDB)
- Building static pages with no dynamic data

**Note**: We ALWAYS use server-side auth (`getAuthSession`), never client-side. Real-time listeners are attached AFTER SSR hydration.

---

## Core Principles

1. **Server-First Data Loading**: Fetch data on the server before rendering, not after
2. **beforeLoad Over loader**: Use `beforeLoad` (not `loader`) for SSR data preloading in TanStack Start
3. **Route Context for Data**: Pass preloaded data through route context, not loader data
4. **Graceful Degradation**: Handle errors gracefully - don't fail page load if data fetch fails
5. **Skip Client Fetch**: Components check for SSR data and skip client-side fetch if present
6. **WebSocket After Hydration**: Real-time listeners attach after SSR hydration completes

---

## Implementation

### Structure

```
src/
├── routes/
│   └── your-route.tsx              # Route with beforeLoad
├── components/
│   └── YourComponent.tsx           # Component using initialData
└── services/
    └── your-database.service.ts    # Database service for SSR
```

### Code Example

#### Step 1: Route Configuration with beforeLoad

```typescript
// src/routes/your-route.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { YourDatabaseService } from '@/services/your-database.service'
import type { YourDataType } from '@/types/your-types'

export const Route = createFileRoute('/your-route')({
  beforeLoad: async () => {
    // 1. Check authentication (if needed)
    const user = await getAuthSession()
    
    if (!user) {
      throw redirect({
        to: '/auth',
        search: { redirect_url: '/your-route' },
      })
    }
    
    // 2. Preload data with proper typing
    let initialData: YourDataType[] = []
    
    try {
      initialData = await YourDatabaseService.getData(user.uid, 50)
    } catch (error) {
      console.error('Failed to preload data:', error)
      // Continue with empty data - not fatal
    }
    
    // 3. Return data through context
    return { 
      user,
      initialData
    }
  },
  component: YourComponent,
})
```

#### Step 2: Component Data Access

```typescript
// src/routes/your-route.tsx (continued)
function YourComponent() {
  // Get data from route context (NOT useLoaderData)
  const context = Route.useRouteContext()
  const { user, initialData } = context
  
  return (
    <div>
      <YourChildComponent initialData={initialData} />
    </div>
  )
}
```

#### Step 3: Child Component Integration

```typescript
// src/components/YourChildComponent.tsx
interface YourChildComponentProps {
  initialData?: YourDataType[]  // SSR data
  className?: string
}

export function YourChildComponent({ 
  initialData = [],  // Default to empty array
  className 
}: YourChildComponentProps) {
  const [data, setData] = useState<YourDataType[]>(initialData)  // Initialize with SSR data
  
  useEffect(() => {
    // Skip loading if we have SSR data
    if (initialData.length > 0) {
      console.log('Using SSR data, skipping client fetch')
      return
    }
    
    // Only load if no SSR data
    loadData()
  }, [initialData.length])
  
  // Component renders immediately with SSR data!
  return (
    <div className={className}>
      {data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

---

## Examples

### Example 1: Chat Messages with SSR

```typescript
// src/routes/chat.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { ConversationDatabaseService } from '@/services/conversation-database.service'
import type { Message } from '@/types/chat'

export const Route = createFileRoute('/chat')({
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user) throw redirect({ to: '/auth' })
    
    const conversationId = 'main'
    let initialMessages: Message[] = []
    
    try {
      initialMessages = await ConversationDatabaseService.getMessages(
        user.uid,
        conversationId,
        50
      )
    } catch (error) {
      console.error('Failed to preload messages:', error)
    }
    
    return { user, conversationId, initialMessages }
  },
  component: Chat,
})

function Chat() {
  const { user, conversationId, initialMessages } = Route.useRouteContext()
  
  return (
    <ChatInterface 
      conversationId={conversationId}
      initialMessages={initialMessages}
    />
  )
}
```

### Example 2: WebSocket Integration with SSR

```typescript
// src/components/chat/ChatInterface.tsx
interface ChatInterfaceProps {
  conversationId?: string
  initialMessages?: Message[]
}

export function ChatInterface({
  conversationId,
  initialMessages = [],
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  
  useEffect(() => {
    const wsClient = new ChatWebSocket({
      onConnectionChange: (isConnected) => {
        // Skip loading if we have SSR data
        if (initialMessages.length > 0) {
          console.log('Skipping WebSocket load - using SSR data')
          return
        }
        
        // Load data via WebSocket if no SSR data
        if (isConnected) {
          wsClient.loadMessages(conversationId)
        }
      },
      onMessageReceived: (newMessage) => {
        // Add new messages from WebSocket
        setMessages(prev => [...prev, newMessage])
      }
    })
    
    return () => wsClient.disconnect()
  }, [initialMessages.length])
  
  // Component renders immediately with SSR data!
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

### Example 3: User Profile with SSR

```typescript
// src/routes/profile.tsx
export const Route = createFileRoute('/profile')({
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user) throw redirect({ to: '/auth' })
    
    let profile = null
    
    try {
      profile = await UserDatabaseService.getProfile(user.uid)
    } catch (error) {
      console.error('Failed to load profile:', error)
    }
    
    return { user, profile }
  },
  component: Profile,
})

function Profile() {
  const { user, profile } = Route.useRouteContext()
  
  return (
    <ProfileView initialProfile={profile} />
  )
}
```

---

## Benefits

### 1. Instant Content Display

Users see content immediately without loading spinners. The page is fully rendered on the server with real data.

**Before SSR**: Page loads → Show spinner → Fetch data → Render data (2-3 seconds)
**After SSR**: Page loads → Data already rendered (<1 second)

### 2. Better SEO

Search engines can index the fully-rendered content since data is present in the initial HTML.

### 3. Improved Perceived Performance

Users perceive the application as faster because they see content immediately, even if real-time updates take a moment to connect.

### 4. Reduced Client-Side Complexity

Components don't need complex loading states for initial data - they start with data already present.

---

## Trade-offs

### 1. Server-Side Execution Time

**Downside**: Data fetching happens on the server, which can slow down initial page load if queries are slow.

**Mitigation**: 
- Set timeouts on data fetches (fail gracefully)
- Only preload essential data
- Use caching where appropriate
- Consider skipping SSR for very slow queries

### 2. Increased Server Load

**Downside**: Every page request executes server-side data fetching, increasing server resource usage.

**Mitigation**:
- Use Cloudflare Workers' edge caching
- Implement query result caching
- Monitor server performance
- Scale horizontally if needed

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Using loader Instead of beforeLoad

**Description**: Using TanStack Router's `loader` instead of `beforeLoad` for SSR data preloading.

**Why it's bad**: May not work correctly in TanStack Start setup, inconsistent with project patterns.

**Instead, do this**: Use `beforeLoad` for SSR data preloading.

```typescript
// ❌ Bad: Using loader
export const Route = createFileRoute('/route')({
  loader: async () => {
    return { data: await fetchData() }
  }
})

// ✅ Good: Using beforeLoad
export const Route = createFileRoute('/route')({
  beforeLoad: async () => {
    return { data: await fetchData() }
  }
})
```

### ❌ Anti-Pattern 2: Forgetting Type Annotation

**Description**: Not providing explicit type annotation for initialData variable.

**Why it's bad**: TypeScript can't infer the type, leading to `any[]` and loss of type safety.

**Instead, do this**: Always provide explicit type annotation.

```typescript
// ❌ Bad: Implicit any[]
let initialData = []

// ✅ Good: Explicit type
let initialData: Message[] = []
```

### ❌ Anti-Pattern 3: Always Fetching on Client

**Description**: Component always fetches data on mount, ignoring SSR data.

**Why it's bad**: Wastes the SSR data, causes unnecessary re-renders, shows loading state unnecessarily.

**Instead, do this**: Check for SSR data first.

```typescript
// ❌ Bad: Always fetching
useEffect(() => {
  loadData()  // Always runs, ignores SSR data
}, [])

// ✅ Good: Check for SSR data
useEffect(() => {
  if (initialData.length > 0) return  // Skip if SSR data exists
  loadData()
}, [initialData.length])
```

### ❌ Anti-Pattern 4: Failing Page Load on Data Error

**Description**: Throwing errors in `beforeLoad` when data fetch fails.

**Why it's bad**: Prevents page from loading at all, poor user experience.

**Instead, do this**: Handle errors gracefully and continue with empty data.

```typescript
// ❌ Bad: Throwing on error
beforeLoad: async () => {
  const data = await fetchData()  // Throws if fails
  return { data }
}

// ✅ Good: Graceful error handling
beforeLoad: async () => {
  let data = []
  try {
    data = await fetchData()
  } catch (error) {
    console.error('Failed to preload:', error)
    // Continue with empty data
  }
  return { data }
}
```

---

## Testing Strategy

### Unit Testing Components with SSR Data

```typescript
import { render, screen } from '@testing-library/react'
import { YourComponent } from './YourComponent'

describe('YourComponent with SSR', () => {
  it('should render with SSR data', () => {
    const initialData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ]
    
    render(<YourComponent initialData={initialData} />)
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })
  
  it('should not fetch data when SSR data provided', () => {
    const loadDataSpy = jest.fn()
    const initialData = [{ id: '1', name: 'Item 1' }]
    
    render(<YourComponent initialData={initialData} />)
    
    expect(loadDataSpy).not.toHaveBeenCalled()
  })
})
```

### Testing SSR with JavaScript Disabled

1. Disable JavaScript in browser
2. Navigate to route
3. Data should still render (proves SSR works)

### Testing Hydration

1. Enable JavaScript
2. Check console for "Using SSR data" log
3. Verify no loading spinner appears
4. Verify no duplicate data fetches

---

## Related Patterns

- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: Database services are used in `beforeLoad` for server-side data fetching
- **[User-Scoped Collections](./tanstack-cloudflare.user-scoped-collections.md)**: SSR preloading works with user-scoped Firestore collections

---

## Migration Guide

### Step 1: Identify Client-Side Data Fetching

Find components that fetch data in `useEffect`:

```typescript
// Current pattern
useEffect(() => {
  fetchData().then(setData)
}, [])
```

### Step 2: Add beforeLoad to Route

```typescript
// Add to route file
export const Route = createFileRoute('/route')({
  beforeLoad: async () => {
    let initialData = []
    try {
      initialData = await YourDatabaseService.getData()
    } catch (error) {
      console.error('Preload failed:', error)
    }
    return { initialData }
  },
  component: YourComponent,
})
```

### Step 3: Update Component to Accept initialData

```typescript
// Update component props
interface Props {
  initialData?: DataType[]
}

export function YourComponent({ initialData = [] }: Props) {
  const [data, setData] = useState(initialData)
  
  useEffect(() => {
    if (initialData.length > 0) return
    fetchData().then(setData)
  }, [initialData.length])
}
```

### Step 4: Pass Data from Route

```typescript
function YourComponent() {
  const { initialData } = Route.useRouteContext()
  return <YourChildComponent initialData={initialData} />
}
```

---

## References

- [TanStack Router Documentation](https://tanstack.com/router/latest)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Server-Side Rendering Best Practices](https://web.dev/rendering-on-the-web/)

---

## Checklist for Implementation

- [ ] Use `beforeLoad` (not `loader`)
- [ ] Add proper TypeScript types for initialData
- [ ] Handle errors gracefully (don't fail page load)
- [ ] Pass data through route context
- [ ] Access with `Route.useRouteContext()`
- [ ] Initialize component state with SSR data
- [ ] Skip client-side fetch if SSR data exists
- [ ] Test with JavaScript disabled
- [ ] Test hydration (no flash/re-render)
- [ ] Test real-time updates still work

---

**Status**: Stable - Proven pattern for TanStack Start + Cloudflare Workers
**Recommendation**: Use for all routes that display user-specific data
**Last Updated**: 2026-02-21
**Contributors**: Patrick Michaelsen
