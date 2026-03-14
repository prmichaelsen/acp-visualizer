# Auth Session Management Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with authentication
**Status**: Stable

---

## Overview

This pattern provides cookie-based session management for TanStack Start applications running on Cloudflare Workers. It uses Firebase Admin SDK for token verification, HTTP-only session cookies for security, and a server function (`getAuthSession`) that can be called from any component, route, or API handler to get the current authenticated user.

The pattern enforces server-side-only authentication — all auth checks happen on the server, never on the client. This prevents token exposure and ensures that authentication state is always authoritative.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building authenticated TanStack Start applications
- Need cookie-based session management
- Using Firebase Authentication as the identity provider
- Need a universal `getAuthSession()` function callable from any context
- Want server-side auth enforcement (never client-side token verification)

❌ **Don't use this pattern when:**
- Building public-only applications with no authentication
- Using a different auth provider that handles sessions differently (Auth0, Clerk)
- Building static sites

---

## Core Principles

1. **Server-Side Only**: All authentication verification happens on the server — never verify tokens client-side
2. **Cookie-Based Sessions**: Use HTTP-only cookies to store session tokens (not localStorage)
3. **Universal Server Function**: `getAuthSession()` is a `createServerFn` callable from any context
4. **Graceful Fallback**: Auth failures return `null`, never throw — callers decide how to handle
5. **Session Cookie Exchange**: Exchange short-lived ID tokens for long-lived session cookies (14 days)
6. **Request-Based Verification**: `getServerSession(request)` extracts and verifies the cookie from the request

---

## Implementation

### Structure

```
src/
├── lib/
│   └── auth/
│       ├── session.ts             # Server-side session verification
│       └── server-fn.ts           # createServerFn wrapper for components
├── types/
│   └── auth.ts                    # User and ServerSession types
├── components/
│   └── auth/
│       ├── AuthContext.tsx         # React context for auth state
│       └── AuthForm.tsx           # Login/register UI
└── routes/
    ├── __root.tsx                 # Root layout with auth initialization
    ├── auth.tsx                   # Auth page
    └── api/
        └── auth/
            ├── session.tsx        # POST: Create session cookie
            └── logout.tsx         # POST: Destroy session
```

### Code Example

#### Step 1: Define Auth Types

```typescript
// src/types/auth.ts
export interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
}

export interface ServerSession {
  user: User
}
```

#### Step 2: Server-Side Session Verification

```typescript
// src/lib/auth/session.ts
import { verifyIdToken, verifySessionCookie, createSessionCookie as createFirebaseSessionCookie }
  from '@prmichaelsen/firebase-admin-sdk-v8'
import type { User, ServerSession } from '@/types/auth'

/**
 * Extract session cookie from request headers
 */
function getSessionCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return undefined

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, value] = cookie.trim().split('=')
    acc[name] = value
    return acc
  }, {} as Record<string, string>)

  return cookies.session
}

/**
 * Get authenticated user from request
 * Returns null if not authenticated — never throws
 */
export async function getServerSession(request: Request): Promise<ServerSession | null> {
  try {
    const sessionCookie = getSessionCookie(request)
    if (!sessionCookie) return null

    // Verify session cookie (try session cookie first, fallback to ID token)
    let decodedToken
    try {
      decodedToken = await verifySessionCookie(sessionCookie)
    } catch {
      decodedToken = await verifyIdToken(sessionCookie)
    }

    const user: User = {
      uid: decodedToken.sub,
      email: decodedToken.email || null,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      emailVerified: decodedToken.email_verified || false,
    }

    return { user }
  } catch (error) {
    console.error('Failed to get server session', error)
    return null
  }
}

/**
 * Create a long-lived session cookie from a Firebase ID token
 */
export async function createSessionCookie(idToken: string): Promise<string> {
  return createFirebaseSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 14 * 1000  // 14 days
  })
}
```

#### Step 3: Universal Server Function

```typescript
// src/lib/auth/server-fn.ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getServerSession } from '@/lib/auth/session'
import { initFirebaseAdmin } from '@/lib/firebase-admin'

/**
 * Server function to get current auth session.
 * Callable from any component, route, or server context.
 */
export const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    initFirebaseAdmin()
    const session = await getServerSession(getRequest())
    return session?.user || null
  } catch (error) {
    console.error('[getAuthSession] Error:', error)
    return null
  }
})
```

#### Step 4: Root Layout with Auth Initialization

```typescript
// src/routes/__root.tsx
import { createRootRouteWithContext } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { AuthProvider } from '@/components/auth/AuthContext'

export const Route = createRootRouteWithContext()({
  beforeLoad: async () => {
    // Fetch auth session server-side (SSR)
    const user = await getAuthSession()
    return { user }
  },
  component: RootLayout,
})

function RootLayout() {
  const { user } = Route.useRouteContext()

  return (
    <AuthProvider initialUser={user}>
      <Outlet />
    </AuthProvider>
  )
}
```

#### Step 5: Auth Context Provider

```typescript
// src/components/auth/AuthContext.tsx
import { createContext, useContext, useState } from 'react'
import type { User } from '@/types/auth'

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ initialUser, children }: {
  initialUser: User | null
  children: React.ReactNode
}) {
  const [user, setUser] = useState<User | null>(initialUser)

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

#### Step 6: Protected Route with Redirect

```typescript
// src/routes/profile.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'

export const Route = createFileRoute('/profile')({
  beforeLoad: async () => {
    const user = await getAuthSession()

    if (!user) {
      throw redirect({
        to: '/auth',
        search: { redirect_url: '/profile' },
      })
    }

    return { user }
  },
  component: ProfilePage,
})
```

#### Step 7: Session Creation API Route

```typescript
// src/routes/api/auth/session.tsx
import { createFileRoute } from '@tanstack/react-router'
import { createSessionCookie } from '@/lib/auth/session'

export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { idToken } = await request.json()
          const sessionCookie = await createSessionCookie(idToken)

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': `session=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`,
            },
          })
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to create session' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

---

## Benefits

### 1. Universal Auth Check
`getAuthSession()` works in components, `beforeLoad`, API routes, and server functions — one function everywhere.

### 2. Secure by Default
HTTP-only cookies prevent XSS attacks. Server-side verification prevents token tampering.

### 3. SSR Compatible
Auth state is available during server-side rendering via `beforeLoad`, enabling instant authenticated content.

### 4. Graceful Degradation
Auth failures return `null` instead of throwing, preventing cascading errors.

---

## Trade-offs

### 1. Firebase Dependency
**Downside**: Tightly coupled to Firebase Admin SDK for token verification.
**Mitigation**: Wrap in an interface if you anticipate switching auth providers.

### 2. Cookie Size Limits
**Downside**: Session cookies have size limits (~4KB).
**Mitigation**: Store minimal data in the cookie (just the session token), not user profile data.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Client-Side Token Verification

```typescript
// ❌ BAD: Verifying tokens on the client
function MyComponent() {
  const token = localStorage.getItem('token')
  const user = jwt.decode(token)  // Client-side decode — not verified!
}

// ✅ GOOD: Always verify on server
const user = await getAuthSession()
```

### ❌ Anti-Pattern 2: Throwing on Auth Failure

```typescript
// ❌ BAD: Throwing prevents page from loading
export async function getServerSession(request) {
  const cookie = getSessionCookie(request)
  if (!cookie) throw new Error('Not authenticated')  // Crashes!
}

// ✅ GOOD: Return null, let callers decide
export async function getServerSession(request) {
  const cookie = getSessionCookie(request)
  if (!cookie) return null  // Graceful
}
```

---

## Related Patterns

- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: API routes use `getAuthSession()` for auth
- **[SSR Preload Pattern](./tanstack-cloudflare.ssr-preload.md)**: `beforeLoad` uses auth for user-specific data
- **[Rate Limiting](./tanstack-cloudflare.rate-limiting.md)**: Rate limit auth endpoints

---

## Checklist for Implementation

- [ ] `getServerSession(request)` returns `ServerSession | null`
- [ ] `getAuthSession` is a `createServerFn` wrapper
- [ ] Session cookie is HTTP-only, Secure, SameSite=Lax
- [ ] Root layout fetches auth in `beforeLoad`
- [ ] AuthProvider wraps app with `initialUser` from SSR
- [ ] Protected routes use `redirect` to `/auth` when not authenticated
- [ ] API routes check `getAuthSession()` before processing
- [ ] Auth failures never throw — always return null
- [ ] Firebase Admin SDK initialized before verification

---

**Status**: Stable - Proven pattern for TanStack Start authentication
**Recommendation**: Use for all authenticated TanStack Start applications
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
