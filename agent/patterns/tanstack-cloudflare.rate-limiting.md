# Rate Limiting Pattern

**Category**: Infrastructure
**Applicable To**: TanStack Start + Cloudflare Workers applications requiring request throttling
**Status**: Stable

---

## Overview

Cloudflare Workers provides a built-in Rate Limiting API via `unsafe.bindings` in `wrangler.toml`. This pattern documents how to configure rate limiting namespaces for different endpoint categories (auth, API, WebSocket), create a reusable rate limiting utility, and enforce limits in API route handlers.

Rate limiters are configured per-namespace with distinct limits — strict limits for auth endpoints (prevent brute force), moderate limits for API endpoints, and connection-based limits for WebSocket upgrades.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Need to protect auth endpoints from brute force attacks
- Want to prevent API abuse
- Need to limit WebSocket connection frequency
- Building production applications exposed to the internet

❌ **Don't use this pattern when:**
- Building internal-only applications with trusted clients
- Development/testing environments (rate limiting adds friction)
- Using an external rate limiting service (Cloudflare WAF rules, etc.)

---

## Core Principles

1. **Namespace Separation**: Different rate limit tiers for different endpoint categories
2. **Fail Open**: If the rate limiter errors, allow the request (don't block users due to infra issues)
3. **User-Based Keys**: Authenticated requests are rate-limited by user ID, unauthenticated by IP
4. **Standard Headers**: Return `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining` headers
5. **429 Response**: Consistently return HTTP 429 with JSON error body when rate limited

---

## Implementation

### Step 1: Configure Wrangler

```toml
# wrangler.toml

# Rate Limiting (Cloudflare Workers Rate Limiting API)
# namespace_id must be a string containing a positive integer

[[unsafe.bindings]]
name = "AUTH_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 5, period = 60 }  # 5 attempts per minute

[[unsafe.bindings]]
name = "API_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1002"
simple = { limit = 100, period = 60 }  # 100 requests per minute

[[unsafe.bindings]]
name = "WS_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1003"
simple = { limit = 10, period = 60 }  # 10 connections per minute
```

### Step 2: Rate Limiting Utility

```typescript
// src/lib/rate-limiter.ts

export interface RateLimitConfig {
  limit: number
  period: number  // seconds
  keyPrefix: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  retryAfter?: number
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  rateLimiter: any,  // Cloudflare Rate Limiter binding
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix}:${identifier}`

  try {
    const { success, limit, remaining, retryAfter } = await rateLimiter.limit({ key })

    return { success, limit, remaining, retryAfter }
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error)
    // Fail open — allow request if rate limiter fails
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit
    }
  }
}

/**
 * Create rate limit error response with standard headers
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = result.retryAfter ?? 60
  const limit = result.limit ?? 100
  const remaining = result.remaining ?? 0

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString()
      }
    }
  )
}

/**
 * Get rate limit identifier from request.
 * Uses user ID if authenticated, IP address otherwise.
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`

  const ip = request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-forwarded-for') ||
             'unknown'

  return `ip:${ip}`
}
```

### Step 3: Use in API Route

```typescript
// src/routes/api/auth/session.tsx
import { createFileRoute } from '@tanstack/react-router'
import { checkRateLimit, createRateLimitResponse, getRateLimitIdentifier } from '@/lib/rate-limiter'

export const Route = createFileRoute('/api/auth/session')({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const env = context.cloudflare.env as Env

        // Rate limit auth endpoints strictly
        const identifier = getRateLimitIdentifier(request)
        const rateLimitResult = await checkRateLimit(
          env.AUTH_RATE_LIMITER,
          identifier,
          { limit: 5, period: 60, keyPrefix: 'auth:session' }
        )

        if (!rateLimitResult.success) {
          return createRateLimitResponse(rateLimitResult)
        }

        // ... handle session creation
      },
    },
  },
})
```

---

## Rate Limit Tiers

| Namespace | Binding | Limit | Use Case |
|-----------|---------|-------|----------|
| Auth | `AUTH_RATE_LIMITER` | 5/min | Login, register, password reset |
| API | `API_RATE_LIMITER` | 100/min | CRUD operations, data queries |
| WebSocket | `WS_RATE_LIMITER` | 10/min | WebSocket connection upgrades |

---

## Examples

### Example 1: Rate Limiting API Endpoints

```typescript
// src/routes/api/conversations/create.tsx
POST: async ({ request, context }) => {
  const env = context.cloudflare.env as Env
  const user = await getAuthSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const identifier = getRateLimitIdentifier(request, user.uid)
  const result = await checkRateLimit(
    env.API_RATE_LIMITER,
    identifier,
    { limit: 100, period: 60, keyPrefix: 'api:conversations' }
  )

  if (!result.success) return createRateLimitResponse(result)

  // ... handle request
}
```

### Example 2: Rate Limiting WebSocket Connections

```typescript
// src/routes/api/chat-ws.tsx
GET: async ({ request, context }) => {
  const env = context.cloudflare.env as Env
  const user = await getAuthSession()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const identifier = getRateLimitIdentifier(request, user.uid)
  const result = await checkRateLimit(
    env.WS_RATE_LIMITER,
    identifier,
    { limit: 10, period: 60, keyPrefix: 'ws:chat' }
  )

  if (!result.success) return createRateLimitResponse(result)

  // Forward to Durable Object for WebSocket upgrade
  const id = env.CHAT_ROOM.idFromName(user.uid)
  return env.CHAT_ROOM.get(id).fetch(request)
}
```

---

## Benefits

### 1. Built-In Infrastructure
No external services needed — rate limiting runs at Cloudflare's edge.

### 2. Per-Namespace Isolation
Different limits for different concerns (auth vs API vs WebSocket).

### 3. Fail-Open Safety
If the rate limiter errors, requests are allowed through — no service disruption.

### 4. Standard HTTP Headers
Clients can programmatically handle rate limits via `Retry-After` header.

---

## Trade-offs

### 1. `unsafe.bindings` Label
**Downside**: Rate limiting uses Cloudflare's `unsafe.bindings`, which may change in future API versions.
**Mitigation**: Abstract behind a utility module (as shown) for easy migration.

### 2. Simple Counter Only
**Downside**: Only supports simple fixed-window rate limiting (not sliding window or token bucket).
**Mitigation**: Sufficient for most applications. Use external services for advanced algorithms.

---

## Anti-Patterns

### ❌ Anti-Pattern: Fail Closed on Rate Limiter Error

```typescript
// ❌ BAD: Blocks all requests if rate limiter fails
const result = await rateLimiter.limit({ key })
// If this throws, the entire request fails

// ✅ GOOD: Fail open
try {
  const result = await rateLimiter.limit({ key })
  if (!result.success) return createRateLimitResponse(result)
} catch {
  // Allow request through if rate limiter is unavailable
}
```

---

## Related Patterns

- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Rate limiting applied in API routes
- **[Auth Session Management](./tanstack-cloudflare.auth-session-management.md)**: Auth endpoints need strict rate limits
- **[Durable Objects WebSocket](./tanstack-cloudflare.durable-objects-websocket.md)**: WebSocket connections rate limited
- **[Wrangler Configuration](./tanstack-cloudflare.wrangler-configuration.md)**: Rate limiter bindings configured in wrangler.toml

---

## Checklist for Implementation

- [ ] Rate limiter bindings configured in `wrangler.toml`
- [ ] Separate namespaces for auth, API, and WebSocket
- [ ] Utility functions for check, response, and identifier extraction
- [ ] Auth endpoints use strict limits (5/min)
- [ ] API endpoints use moderate limits (100/min)
- [ ] WebSocket connections use connection-based limits (10/min)
- [ ] Rate limiter errors fail open (allow request)
- [ ] 429 responses include `Retry-After` header
- [ ] Rate limit identifier uses user ID when authenticated, IP otherwise

---

**Status**: Stable - Production-ready rate limiting for Cloudflare Workers
**Recommendation**: Use for all production applications exposed to the internet
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
