# Firebase Authentication

**Category**: Code
**Applicable To**: All server-side auth verification, session management, API route protection, and SSR auth checks
**Status**: Stable

---

## Overview

This pattern covers how Firebase Admin SDK authentication is used throughout the project: session cookie management, token verification, route guards, SSR auth, and the client-to-server auth handshake. The project uses a dual-layer system: Firebase Client SDK for client-side auth (sign-in/sign-up) and Firebase Admin SDK (`@prmichaelsen/firebase-admin-sdk-v8`) for server-side session management via long-lived session cookies.

---

## When to Use This Pattern

**Use this pattern when:**
- Adding a new API route that requires authentication
- Adding a new SSR `beforeLoad` that needs user context
- Building a new server function (`createServerFn`) that accesses user data
- Implementing admin-only routes or features

**Don't use this pattern when:**
- Working on purely client-side components with no server interaction
- Building public/unauthenticated endpoints (use no auth check)
- Implementing MCP server auth (use `mcp-jwt.ts` JWT tokens instead)

---

## Core Principles

1. **Session Cookies Over ID Tokens**: Server-side auth uses 14-day session cookies, not short-lived ID tokens
2. **Dual Verification Fallback**: `verifySessionCookie()` first, then `verifyIdToken()` for migration compatibility
3. **Null on Failure**: Auth functions return `null` on error, never throw — callers decide how to respond
4. **Always Initialize First**: Call `initFirebaseAdmin()` before any auth operation
5. **Anonymous Users Are Valid**: Anonymous sessions are real auth sessions — check `isAnonymous` when restricting features

---

## Implementation

### Auth Flow Overview

```
Client                              Server
  │                                    │
  ├─ Firebase signIn/signUp ──────►    │
  │  (gets ID token)                   │
  │                                    │
  ├─ POST /api/auth/login ──────────►  │
  │  { idToken, turnstileToken? }      │
  │                                    ├─ verifyIdToken(idToken)
  │                                    ├─ createSessionCookie(idToken, 14d)
  │                                    ├─ Set-Cookie: session=...
  │  ◄────────────────────────────────  │
  │                                    │
  ├─ GET /api/some-endpoint ─────────► │
  │  Cookie: session=...               ├─ getServerSession(request)
  │                                    │   └─ verifySessionCookie(cookie)
  │                                    │   └─ fallback: verifyIdToken(cookie)
  │  ◄─── { data } ──────────────────  │
```

### Key Functions

#### `initFirebaseAdmin()` — SDK Initialization

**File**: `src/lib/firebase-admin.ts`

```typescript
import { initializeApp as _initializeApp } from '@prmichaelsen/firebase-admin-sdk-v8'

export function initFirebaseAdmin() {
  _initializeApp({
    serviceAccount: process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}
```

Called at the start of every API route handler and SSR `beforeLoad`. Idempotent — safe to call multiple times.

#### `getServerSession(request)` — Session Verification

**File**: `src/lib/auth/session.ts`

```typescript
import { verifyIdToken, verifySessionCookie } from '@prmichaelsen/firebase-admin-sdk-v8'

export async function getServerSession(request: Request): Promise<ServerSession | null> {
  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) return null

  let decodedToken
  try {
    decodedToken = await verifySessionCookie(sessionCookie)
  } catch {
    // Migration fallback — old ID tokens in cookies
    decodedToken = await verifyIdToken(sessionCookie)
  }

  const isAnonymous = decodedToken.firebase?.sign_in_provider === 'anonymous' || !decodedToken.email

  return {
    user: {
      uid: decodedToken.sub,
      email: decodedToken.email || null,
      displayName: decodedToken.name || null,
      photoURL: decodedToken.picture || null,
      emailVerified: decodedToken.email_verified || false,
      isAnonymous,
    }
  }
}
```

#### `getAuthSession()` — TanStack Server Function

**File**: `src/lib/auth/server-fn.ts`

```typescript
export const getAuthSession = createServerFn({ method: 'GET' }).handler(async () => {
  initFirebaseAdmin()
  const session = await getServerSession(getRequest())
  return session?.user || null
})
```

Uses `getRequest()` from `@tanstack/react-start/server` to access the Request object.

#### `createSessionCookie(idToken)` — Cookie Creation

**File**: `src/lib/auth/session.ts`

```typescript
export async function createSessionCookie(idToken: string): Promise<string> {
  const sessionCookie = await createFirebaseSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 14 * 1000 // 14 days
  })
  return sessionCookie
}
```

#### Route Guards

**File**: `src/lib/auth/guards.ts`

```typescript
export async function requireAuth(request: Request): Promise<Response | null> {
  const session = await getServerSession(request)
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  return null // null = authorized
}

export async function requireAdmin(request: Request): Promise<Response | null> {
  const session = await getServerSession(request)
  if (!session?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const ownerEmails = (process.env.OWNER_EMAILS || '').split(',').map(e => e.trim())
  if (!session.user.email || !ownerEmails.includes(session.user.email)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return null
}
```

---

## Examples

### Example 1: API Route with Auth

```typescript
// src/routes/api/some-endpoint.tsx
GET: async () => {
  initFirebaseAdmin()

  const user = await getAuthSession()
  if (!user || user.isAnonymous) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const data = await SomeDatabaseService.getData(user.uid)
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### Example 2: SSR beforeLoad with Auth Redirect

```typescript
// src/routes/settings/index.tsx
export const Route = createFileRoute('/settings/')({
  beforeLoad: (async ({ context }: any) => {
    const user = context.initialUser  // From root beforeLoad
    if (!user || user.isAnonymous) {
      throw redirect({
        to: '/auth',
        search: { redirect_url: '/settings' },
      })
    }
    return { initialUser: user }
  }) as any,
  component: SettingsPage,
})
```

### Example 3: Server Function with Auth

```typescript
const updateProfile = createServerFn({ method: 'POST' })
  .inputValidator((data: UpdateProfileInput) => data)
  .handler(async ({ data }) => {
    initFirebaseAdmin()
    const session = await getServerSession(getRequest())
    if (!session?.user) throw new Error('Unauthorized')

    return await ProfileDatabaseService.updateProfile(session.user.uid, data)
  })
```

### Example 4: Root Route — Global Auth Preloading

```typescript
// src/routes/__root.tsx
beforeLoad: async () => {
  const user = await getAuthSession()

  let initialAIConsent, initialTosAccepted
  if (typeof window === 'undefined' && user && !user.isAnonymous) {
    initFirebaseAdmin()
    const [consent, tos] = await Promise.all([
      ConsentDatabaseService.getAIConsent(user.uid),
      TosConsentDatabaseService.hasAcceptedCurrentTos(user.uid),
    ])
    initialAIConsent = consent?.ai_data_sharing ?? null
    initialTosAccepted = tos
  }

  return { initialUser: user, initialAIConsent, initialTosAccepted }
}
```

---

## Anti-Patterns

### Using `getAuthSession()` Where You Have `context.initialUser`

```typescript
// Bad: Redundant server function call when root already provides user
beforeLoad: async () => {
  const user = await getAuthSession()  // Unnecessary extra call
  if (!user) throw redirect({ to: '/auth' })
}

// Good: Use context from root beforeLoad
beforeLoad: async ({ context }: any) => {
  const user = context.initialUser  // Already fetched by root
  if (!user) throw redirect({ to: '/auth' })
}
```

### Throwing on Auth Failure in Session Functions

```typescript
// Bad: Throws — callers can't distinguish auth failure from server error
export async function getServerSession(request: Request) {
  const cookie = getSessionCookie(request)
  if (!cookie) throw new Error('No session')  // Don't throw
}

// Good: Returns null — caller decides the response
export async function getServerSession(request: Request): Promise<ServerSession | null> {
  const cookie = getSessionCookie(request)
  if (!cookie) return null
}
```

### Forgetting `initFirebaseAdmin()` in API Routes

```typescript
// Bad: Will fail on first request
GET: async () => {
  const user = await getAuthSession()  // Firebase not initialized!
}

// Good: Always initialize
GET: async () => {
  initFirebaseAdmin()
  const user = await getAuthSession()
}
```

---

## Key Design Decisions

### Session Management

| Decision | Choice | Rationale |
|---|---|---|
| Session mechanism | 14-day session cookie | Longer-lived than ID tokens (1 hour), reduces re-auth |
| Cookie flags | HttpOnly, SameSite=Lax, Secure (prod) | Prevents XSS token theft; Secure disabled on localhost |
| Token fallback | verifySessionCookie → verifyIdToken | Migration compatibility for old ID token cookies |
| Anonymous users | Auto-created on first visit | Enables chat in The Void without signup |

### Auth Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Admin detection | Email match against OWNER_EMAILS env | Simple, no separate admin role system needed |
| MCP auth | Separate JWT system (mcp-jwt.ts) | MCP servers need stateless tokens, not session cookies |
| Rate limiting | 5/min login, 3/5min signup | Prevent brute force and spam signups |
| CAPTCHA | Turnstile for signups, fail-open | Block bots but don't break auth if Turnstile API is down |

---

## Checklist for Implementation

- [ ] Call `initFirebaseAdmin()` before any auth operation
- [ ] Use `getAuthSession()` for server functions, `getServerSession(request)` for API routes
- [ ] Check `isAnonymous` when the feature requires a real account
- [ ] Return `null` on auth failure in utility functions (don't throw)
- [ ] Return 401 for unauthenticated, 403 for forbidden in API routes
- [ ] Use `context.initialUser` in `beforeLoad` instead of re-calling `getAuthSession()`
- [ ] Redirect to `/auth?redirect_url=...` for protected pages, not just `/auth`

---

## Related Patterns

- **[Database Service Conventions](./database-service-conventions.md)**: Auth-verified userId flows into all database service calls
- **[SSR Preload](./ssr-preload.md)**: SSR `beforeLoad` uses auth context for server-side data fetching

---

**Status**: Stable
**Recommendation**: Follow this pattern for all new API routes, server functions, and SSR routes requiring authentication
**Last Updated**: 2026-03-14
**Contributors**: Community
