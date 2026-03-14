# API Route Handlers Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with REST API endpoints
**Status**: Stable

---

## Overview

TanStack Start provides file-based API routing where each file in `src/routes/api/` becomes an HTTP endpoint. This pattern documents the standard approach for creating authenticated, type-safe API routes that delegate to service layers and return proper JSON responses with consistent error handling.

API routes use `createFileRoute` with the `server.handlers` configuration to define HTTP method handlers (GET, POST, PATCH, DELETE) that run exclusively on the server. Each handler follows a consistent structure: authenticate, validate, delegate to service, return response.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building REST API endpoints consumed by client-side services
- Need server-side authentication enforcement
- Creating CRUD operations for domain entities
- Building endpoints consumed by external clients or webhooks
- Need consistent error handling and response formats

❌ **Don't use this pattern when:**
- Building real-time features (use Durable Objects WebSocket instead)
- Server functions (`createServerFn`) are sufficient for the use case
- The endpoint is purely for SSR data preloading (use `beforeLoad` instead)

---

## Core Principles

1. **Auth First**: Every handler starts with authentication check
2. **Service Delegation**: Handlers delegate to database services, never access DB directly
3. **Consistent Responses**: All responses use `new Response(JSON.stringify(...))` with proper headers
4. **Error Boundaries**: Every handler wrapped in try/catch with consistent error response format
5. **File-Based Routing**: Route path derived from file location in `src/routes/api/`
6. **HTTP Method Handlers**: Use `server.handlers` with explicit GET/POST/PATCH/DELETE

---

## Implementation

### Structure

```
src/routes/api/
├── conversations/
│   ├── index.tsx                  # GET /api/conversations (list)
│   ├── create.tsx                 # POST /api/conversations/create
│   └── $id/
│       ├── index.tsx              # GET/PATCH/DELETE /api/conversations/:id
│       └── messages.tsx           # GET /api/conversations/:id/messages
├── groups/
│   ├── index.tsx                  # GET /api/groups
│   ├── create.tsx                 # POST /api/groups/create
│   └── $id/
│       ├── index.tsx              # GET/PATCH/DELETE /api/groups/:id
│       └── members/
│           └── $userId.tsx        # POST/DELETE /api/groups/:id/members/:userId
├── auth/
│   ├── session.tsx                # POST /api/auth/session (create session)
│   └── logout.tsx                 # POST /api/auth/logout
└── storage/
    └── upload.tsx                 # POST /api/storage/upload
```

### Code Example

#### Standard GET Handler (List)

```typescript
// src/routes/api/groups/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { GroupConversationDatabaseService } from '@/services/group-conversation-database.service'
import { initFirebaseAdmin } from '@/lib/firebase-admin'

export const Route = createFileRoute('/api/groups/')({
  server: {
    handlers: {
      GET: async () => {
        initFirebaseAdmin()

        try {
          // 1. Authenticate
          const user = await getAuthSession()
          if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // 2. Delegate to service
          const groups = await GroupConversationDatabaseService.listGroupConversations(user.uid)

          // 3. Return success response
          return new Response(JSON.stringify({ groups }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          // 4. Handle errors consistently
          console.error('[API] Error listing groups:', error)
          return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

#### Standard POST Handler (Create)

```typescript
// src/routes/api/groups/create.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { GroupConversationDatabaseService } from '@/services/group-conversation-database.service'
import { CreateGroupSchema } from '@/schemas/group-conversation'

export const Route = createFileRoute('/api/groups/create')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        initFirebaseAdmin()

        try {
          const user = await getAuthSession()
          if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Parse and validate body
          const body = await request.json()
          const parsed = CreateGroupSchema.safeParse(body)

          if (!parsed.success) {
            return new Response(JSON.stringify({
              error: 'Validation error',
              details: parsed.error.issues,
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Delegate to service
          const group = await GroupConversationDatabaseService.createGroupConversation(
            user.uid,
            parsed.data
          )

          return new Response(JSON.stringify({ group }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[API] Error creating group:', error)
          return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

#### Dynamic Route Parameters

```typescript
// src/routes/api/groups/$id/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/groups/$id/')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params  // Group ID from URL

        const user = await getAuthSession()
        if (!user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const group = await GroupConversationDatabaseService.getGroupConversation(user.uid, id)

        if (!group) {
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ group }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },

      PATCH: async ({ params, request }) => {
        const { id } = params
        // ... update logic
      },

      DELETE: async ({ params }) => {
        const { id } = params
        // ... delete logic
      },
    },
  },
})
```

---

## Response Format Convention

### Success Responses

```typescript
// List operations: wrap in plural key
return Response.json({ groups })           // 200
return Response.json({ conversations })    // 200

// Single entity operations
return Response.json({ group })            // 200 (get/update)
return Response.json({ group })            // 201 (create)

// Delete operations
return Response.json({ success: true })    // 200
```

### Error Responses

```typescript
// Authentication
return Response.json({ error: 'Unauthorized' }, { status: 401 })

// Validation
return Response.json({
  error: 'Validation error',
  details: zodError.issues
}, { status: 400 })

// Not found
return Response.json({ error: 'Not found' }, { status: 404 })

// Forbidden
return Response.json({ error: 'Forbidden' }, { status: 403 })

// Rate limited
return Response.json({
  error: 'Too many requests',
  retryAfter: 60
}, { status: 429 })

// Server error
return Response.json({
  error: 'Internal server error',
  message: error.message
}, { status: 500 })
```

---

## Benefits

### 1. File-Based Discovery
API routes are discoverable by browsing `src/routes/api/`. The file path IS the URL path.

### 2. Consistent Auth Pattern
Every handler starts with the same auth check, making security audits straightforward.

### 3. Type-Safe Parameters
Dynamic route parameters (`$id`) are typed and extracted from `params`.

### 4. Server-Only Execution
Handlers in `server.handlers` never run on the client, preventing accidental secret exposure.

---

## Trade-offs

### 1. Verbose Response Construction
**Downside**: `new Response(JSON.stringify(...))` is verbose compared to frameworks with built-in helpers.
**Mitigation**: Create helper functions like `jsonResponse(data, status)` if desired.

### 2. No Built-In Middleware
**Downside**: No middleware system for cross-cutting concerns (auth, logging, rate limiting).
**Mitigation**: Extract auth/validation into reusable functions called at the start of each handler.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Direct Database Access in Route

```typescript
// ❌ BAD: Direct Firestore call in route handler
GET: async () => {
  const docs = await queryDocuments('groups', {})  // Direct DB access!
  return Response.json({ groups: docs })
}

// ✅ GOOD: Delegate to service
GET: async () => {
  const groups = await GroupDatabaseService.listGroups(user.uid)
  return Response.json({ groups })
}
```

### ❌ Anti-Pattern 2: Missing Error Handler

```typescript
// ❌ BAD: No try/catch — unhandled errors crash the worker
GET: async () => {
  const user = await getAuthSession()
  const groups = await service.listGroups(user.uid)  // Could throw!
  return Response.json({ groups })
}

// ✅ GOOD: Wrapped in try/catch
GET: async () => {
  try {
    const user = await getAuthSession()
    const groups = await service.listGroups(user.uid)
    return Response.json({ groups })
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### ❌ Anti-Pattern 3: Skipping Auth Check

```typescript
// ❌ BAD: No authentication — anyone can access
GET: async () => {
  const groups = await service.listGroups('some-user-id')
  return Response.json({ groups })
}

// ✅ GOOD: Always authenticate first
GET: async () => {
  const user = await getAuthSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const groups = await service.listGroups(user.uid)
  return Response.json({ groups })
}
```

---

## Related Patterns

- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: API routes delegate to database services
- **[Auth Session Management](./tanstack-cloudflare.auth-session-management.md)**: `getAuthSession()` used in every handler
- **[Zod Schema Validation](./tanstack-cloudflare.zod-schema-validation.md)**: Request body validation with Zod
- **[Rate Limiting](./tanstack-cloudflare.rate-limiting.md)**: Rate limit API endpoints

---

## Checklist for Implementation

- [ ] Route file uses `createFileRoute` with `server.handlers`
- [ ] Every handler starts with `getAuthSession()` check
- [ ] Request body validated with Zod `safeParse` for POST/PATCH
- [ ] All responses include `Content-Type: application/json` header
- [ ] Error responses use consistent `{ error, message? }` format
- [ ] Every handler wrapped in try/catch
- [ ] Dynamic route parameters accessed via `params`
- [ ] Database operations delegated to service layer
- [ ] Firebase Admin SDK initialized at handler start

---

**Status**: Stable - Standard pattern for TanStack Start API endpoints
**Recommendation**: Use for all REST API endpoints in TanStack Start applications
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
