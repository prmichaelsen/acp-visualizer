# Next.js to TanStack Start Routing Migration

**Category**: Migration
**Applicable To**: Projects migrating from Next.js App Router to TanStack Start + Cloudflare Workers
**Status**: Stable

---

## Overview

This pattern maps Next.js App Router conventions to their TanStack Start equivalents. It covers page routes, layouts, API routes, dynamic parameters, metadata, server-side data fetching, and middleware. The goal is a systematic migration where each Next.js file has a clear TanStack Start counterpart.

Both frameworks use file-based routing, but they differ in naming conventions, data loading strategies, and API route syntax. This guide provides side-by-side mappings with code examples.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Migrating an existing Next.js App Router application to TanStack Start
- Need a reference for mapping Next.js conventions to TanStack equivalents
- Building new features and want to know the TanStack way of doing something familiar from Next.js

❌ **Don't use this pattern when:**
- Migrating from Next.js Pages Router (different conventions)
- Building a new project from scratch (use other patterns directly)

---

## Route File Mapping

| Next.js App Router | TanStack Start | Notes |
|-------------------|----------------|-------|
| `app/page.tsx` | `routes/index.tsx` | Home page |
| `app/layout.tsx` | `routes/__root.tsx` | Root layout |
| `app/about/page.tsx` | `routes/about.tsx` | Static page |
| `app/blog/[id]/page.tsx` | `routes/blog/$id.tsx` | Dynamic route (`[id]` → `$id`) |
| `app/blog/[...slug]/page.tsx` | `routes/blog/$.tsx` | Catch-all route |
| `app/api/posts/route.ts` | `routes/api/posts/index.tsx` | API route |
| `app/api/posts/[id]/route.ts` | `routes/api/posts/$id.tsx` | Dynamic API route |
| `app/(group)/page.tsx` | `routes/_group/index.tsx` | Route group (parentheses → underscore) |
| `app/loading.tsx` | `pendingComponent` on route | Loading state |
| `app/error.tsx` | `errorComponent` on route | Error boundary |
| `app/not-found.tsx` | `notFoundComponent` on route | 404 handler |

---

## Page Routes

### Next.js: Server Component with Data Fetching

```typescript
// app/home/page.tsx (Next.js)
import { cookies } from 'next/headers'
import { getServerSession } from '@/lib/auth-server'
import HomePageClient from './HomePageClient'

export const metadata = {
  title: 'Home',
  description: 'Your neighborhood feed',
}

export default async function HomePage() {
  const cookieStore = cookies()
  const session = cookieStore.get('session')
  // Fetch data server-side...
  return <HomePageClient />
}
```

### TanStack Start: Route with beforeLoad

```typescript
// routes/home.tsx (TanStack Start)
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'

export const Route = createFileRoute('/home')({
  // Server-side data fetching (replaces async Server Component)
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user) {
      throw redirect({ to: '/auth', search: { redirect_url: '/home' } })
    }

    let posts = []
    try {
      posts = await PostDatabaseService.getFeed(user.uid, 50)
    } catch (error) {
      console.error('Failed to preload feed:', error)
    }

    return { user, posts }
  },

  // SEO metadata (replaces export const metadata)
  meta: () => [
    { title: 'Home' },
    { name: 'description', content: 'Your neighborhood feed' },
  ],

  component: HomePage,
})

function HomePage() {
  const { user, posts } = Route.useRouteContext()
  return <HomePageClient initialPosts={posts} />
}
```

---

## Layouts

### Next.js: layout.tsx

```typescript
// app/layout.tsx (Next.js)
import { cookies } from 'next/headers'
import ReduxProvider from '@/components/ReduxProvider'

export default async function RootLayout({ children }) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('session')

  let initialState
  try {
    initialState = await getStateFromHeaders(sessionCookie?.value)
  } catch { initialState = {} }

  return (
    <html lang="en">
      <body>
        <ReduxProvider initialState={initialState}>
          <Navbar />
          {children}
          <ModalContainer />
          <ToastContainer />
        </ReduxProvider>
      </body>
    </html>
  )
}
```

### TanStack Start: __root.tsx

```typescript
// routes/__root.tsx (TanStack Start)
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import ReduxProvider from '@/components/ReduxProvider'

export const Route = createRootRouteWithContext()({
  beforeLoad: async () => {
    const user = await getAuthSession()
    return { user }
  },
  component: RootLayout,
})

function RootLayout() {
  const { user } = Route.useRouteContext()

  return (
    <ReduxProvider initialUser={user}>
      <Navbar />
      <Outlet />  {/* Replaces {children} */}
      <ModalContainer />
      <ToastContainer />
    </ReduxProvider>
  )
}
```

**Key differences**:
- `{children}` → `<Outlet />`
- `cookies()` from `next/headers` → `getAuthSession()` server function
- Metadata in `export const metadata` → `meta` function on route
- `<html>` and `<body>` go in a separate entry file, not in `__root.tsx`

---

## API Routes

### Next.js: Route Handlers

```typescript
// app/api/posts/create/route.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const session = await getServerSession(request)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const post = await PostDatabaseService.create(session.user.uid, body)

  return NextResponse.json(post, { status: 201 })
}
```

### TanStack Start: Server Handlers

```typescript
// routes/api/posts/create.tsx (TanStack Start)
import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'

export const Route = createFileRoute('/api/posts/create')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getAuthSession()
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = await request.json()
        const post = await PostDatabaseService.create(user.uid, body)

        return new Response(JSON.stringify(post), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

**Key differences**:
- `NextResponse.json()` → `new Response(JSON.stringify())` with headers
- `export async function POST` → `server.handlers.POST`
- `NextRequest` type → standard `Request`
- File extension `.ts` → `.tsx`

---

## Dynamic Routes

### Next.js: [id] Parameter

```typescript
// app/api/posts/[id]/route.ts (Next.js)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const post = await PostDatabaseService.getById(params.id)
  return NextResponse.json(post)
}
```

### TanStack Start: $id Parameter

```typescript
// routes/api/posts/$id.tsx (TanStack Start)
export const Route = createFileRoute('/api/posts/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const post = await PostDatabaseService.getById(params.id)
        return new Response(JSON.stringify(post), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

**Key difference**: `[id]` → `$id` in file names. Params accessed the same way.

---

## Server-Side Data Fetching

| Next.js Pattern | TanStack Start Equivalent |
|----------------|--------------------------|
| `async function Page()` (Server Component) | `beforeLoad` on route |
| `cookies()` from `next/headers` | `getRequest()` from `@tanstack/react-start/server` |
| `headers()` from `next/headers` | `getRequest().headers` |
| `fetch()` in Server Component | Database service call in `beforeLoad` |
| `revalidatePath()` / `revalidateTag()` | Not needed (no ISR — always fresh on Workers) |
| `generateStaticParams()` | Not applicable (no SSG on Workers) |

---

## Metadata / SEO

### Next.js: Metadata Export

```typescript
// app/profile/[username]/page.tsx (Next.js)
export async function generateMetadata({ params }) {
  const profile = await getProfile(params.username)
  return {
    title: profile.displayName,
    openGraph: { title: profile.displayName, images: [profile.avatar] },
  }
}
```

### TanStack Start: meta Function

```typescript
// routes/profile/$username.tsx (TanStack Start)
export const Route = createFileRoute('/profile/$username')({
  beforeLoad: async ({ params }) => {
    const profile = await ProfileDatabaseService.getByUsername(params.username)
    return { profile }
  },
  meta: ({ loaderData }) => [
    { title: loaderData.profile?.displayName },
    { property: 'og:title', content: loaderData.profile?.displayName },
  ],
  component: ProfilePage,
})
```

---

## Middleware

### Next.js: middleware.ts

```typescript
// middleware.ts (Next.js — runs on every request)
import { NextResponse } from 'next/server'
export function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check auth, redirect if needed
  }
  return NextResponse.next()
}
export const config = { matcher: ['/admin/:path*'] }
```

### TanStack Start: beforeLoad on Parent Route

```typescript
// routes/admin.tsx (TanStack Start — layout route for /admin/*)
export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user?.isAdmin) {
      throw redirect({ to: '/auth' })
    }
    return { user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return <Outlet />  // Child admin routes render here
}
```

**Key difference**: No global middleware file. Use `beforeLoad` on parent routes for path-specific guards.

---

## SSE / Streaming Responses

### Next.js: ReadableStream

```typescript
// app/api/chat/stream/route.ts (Next.js)
export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk' })}\n\n`))
      controller.close()
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

### TanStack Start: Same Pattern (Web Standards)

```typescript
// routes/api/chat/stream.tsx (TanStack Start)
POST: async ({ request }) => {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk' })}\n\n`))
      controller.close()
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

SSE streaming is identical — both use Web Standard `ReadableStream`. However, for real-time chat consider migrating to **Durable Objects WebSocket** instead of SSE.

---

## Migration Checklist

### Phase 1: Project Setup
- [ ] Initialize TanStack Start project with Cloudflare Workers
- [ ] Configure `wrangler.toml` (see [wrangler-configuration](./tanstack-cloudflare.wrangler-configuration.md))
- [ ] Set up `vite.config.ts` with TanStack + Cloudflare plugins
- [ ] Configure path aliases (`@/` → `./src/`)
- [ ] Move environment variables to Cloudflare secrets

### Phase 2: Route Migration
- [ ] Convert `app/layout.tsx` → `routes/__root.tsx`
- [ ] Convert `app/page.tsx` → `routes/index.tsx`
- [ ] Convert page routes: `app/X/page.tsx` → `routes/X.tsx`
- [ ] Convert dynamic routes: `[id]` → `$id`
- [ ] Convert `metadata` exports → `meta` functions
- [ ] Move `{children}` to `<Outlet />`

### Phase 3: API Route Migration
- [ ] Convert `app/api/X/route.ts` → `routes/api/X/index.tsx`
- [ ] Replace `NextRequest`/`NextResponse` with Web Standard `Request`/`Response`
- [ ] Replace `export async function GET/POST` → `server.handlers.GET/POST`
- [ ] Replace `cookies()` API with cookie parsing from request headers

### Phase 4: Data Fetching Migration
- [ ] Replace async Server Components with `beforeLoad`
- [ ] Replace `cookies()`/`headers()` with `getAuthSession()` server function
- [ ] Remove `revalidatePath`/`revalidateTag` (not needed on Workers)
- [ ] Remove `generateStaticParams` (no SSG on Workers)

### Phase 5: Next.js Specific Removal
- [ ] Remove `next.config.js`
- [ ] Remove `middleware.ts` (use `beforeLoad` guards)
- [ ] Remove `next/image` usage (use standard `<img>` or Cloudflare Images)
- [ ] Remove `next/link` (use TanStack Router `<Link>`)
- [ ] Remove `next/navigation` (use TanStack Router hooks)
- [ ] Remove `next/headers` usage

---

## Related Patterns

- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Target API route pattern
- **[SSR Preload](./tanstack-cloudflare.ssr-preload.md)**: Replaces async Server Components
- **[Auth Session Management](./tanstack-cloudflare.auth-session-management.md)**: Replaces `cookies()` auth pattern
- **[Wrangler Configuration](./tanstack-cloudflare.wrangler-configuration.md)**: Replaces `vercel.json` + `next.config.js`

---

**Status**: Stable - Comprehensive migration reference
**Recommendation**: Use as a lookup guide during Next.js → TanStack Start migration
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
