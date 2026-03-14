# Scheduled Tasks Pattern

**Category**: Infrastructure
**Applicable To**: TanStack Start + Cloudflare Workers applications requiring cron jobs
**Status**: Stable

---

## Overview

Cloudflare Workers supports Cron Triggers — scheduled tasks that run on a configurable schedule without requiring external cron services. This pattern replaces the common Next.js approach of exposing `/api/scheduled/*` endpoints that are hit by external cron services (Vercel Cron, Google Cloud Scheduler, etc.).

With Cron Triggers, the schedule is defined in `wrangler.toml` and the handler is a `scheduled` event in your worker, eliminating the need for external schedulers, API keys for cron endpoints, or separate Cloud Run services.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Need periodic background tasks (daily digests, reminders, token refresh)
- Migrating from external cron-triggered API endpoints
- Want scheduled tasks co-located with your application code
- Need reliable execution without external scheduler dependencies

❌ **Don't use this pattern when:**
- Tasks need to run for more than the Workers CPU time limit (300s on paid plan)
- Tasks require interactive user input
- Need sub-minute scheduling precision

---

## Core Principles

1. **Declarative Schedules**: Cron schedules defined in `wrangler.toml`, not application code
2. **Event-Based Handler**: Uses `scheduled` event, not HTTP endpoints
3. **Routing by Cron Expression**: Use `event.cron` to dispatch to the right handler
4. **Fail-Safe Execution**: Errors are logged but don't crash the worker
5. **Debug Endpoint**: Keep an HTTP endpoint for manual testing/triggering

---

## Implementation

### Step 1: Configure Cron Triggers in wrangler.toml

```toml
# wrangler.toml

[triggers]
crons = [
  "0 7 * * *",     # Daily at 7:00 AM UTC — daily digest
  "*/15 * * * *",  # Every 15 minutes — clean reminders
  "0 */6 * * *",   # Every 6 hours — token refresh
]
```

### Step 2: Handle Scheduled Events in Server Entry

```typescript
// src/server.ts (or worker entry point)

export default {
  // Standard fetch handler for HTTP requests (TanStack Start handles this)
  fetch: app.fetch,

  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduledEvent(event, env))
  },
}

async function handleScheduledEvent(event: ScheduledEvent, env: Env): Promise<void> {
  console.log(`[Cron] Triggered: ${event.cron} at ${new Date(event.scheduledTime).toISOString()}`)

  try {
    switch (event.cron) {
      case '0 7 * * *':
        await handleDailyDigest(env)
        break
      case '*/15 * * * *':
        await handleCleanReminders(env)
        break
      case '0 */6 * * *':
        await handleTokenRefresh(env)
        break
      default:
        console.warn(`[Cron] Unknown cron expression: ${event.cron}`)
    }
  } catch (error) {
    console.error(`[Cron] Failed for ${event.cron}:`, error)
    // Don't rethrow — cron failures should be logged, not crash the worker
  }
}
```

### Step 3: Implement Task Handlers

```typescript
// src/lib/scheduled/daily-digest.ts

export async function handleDailyDigest(env: Env): Promise<void> {
  console.log('[DailyDigest] Starting daily digest...')

  // 1. Query data
  const checkIns = await ReservationDatabaseService.getTodayCheckIns()
  const checkOuts = await ReservationDatabaseService.getTodayCheckOuts()
  const unclaimedCleans = await AppointmentDatabaseService.getUnclaimedNextWeek()

  // 2. Build email content
  const html = buildDigestEmail({
    checkIns,
    checkOuts,
    unclaimedCleans,
  })

  // 3. Send email
  await sendEmail({
    to: env.MANAGER_EMAILS,
    subject: `Daily Digest — ${new Date().toLocaleDateString()}`,
    html,
  })

  console.log('[DailyDigest] Complete')
}
```

```typescript
// src/lib/scheduled/token-refresh.ts

export async function handleTokenRefresh(env: Env): Promise<void> {
  console.log('[TokenRefresh] Refreshing external API tokens...')

  // Refresh Guesty OAuth token
  try {
    const guestyToken = await GuestyAuthService.refreshToken()
    await GuestyTokenStorage.store(guestyToken)
    console.log('[TokenRefresh] Guesty token refreshed')
  } catch (error) {
    console.error('[TokenRefresh] Guesty refresh failed:', error)
    // Continue with other refreshes
  }

  // Refresh other tokens...
}
```

### Step 4: Keep Debug HTTP Endpoint

```typescript
// routes/api/scheduled/daily-digest.tsx
// Manual trigger for testing — protected by admin auth

import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { handleDailyDigest } from '@/lib/scheduled/daily-digest'

export const Route = createFileRoute('/api/scheduled/daily-digest')({
  server: {
    handlers: {
      POST: async ({ request, context }) => {
        const user = await getAuthSession()
        if (!user?.isAdmin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const env = context.cloudflare.env as Env
        const body = await request.json()
        const { debug = false } = body

        if (debug) {
          // Return preview data without sending
          const data = await buildDigestPreview()
          return new Response(JSON.stringify({ success: true, preview: data }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        await handleDailyDigest(env)
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

---

## Migrating from Next.js Scheduled Endpoints

### Before (Next.js + External Cron)

```
External Cron (Vercel/GCP)
  → POST /api/scheduled/daily-digest (with API key auth)
    → Next.js route handler
      → Business logic
```

### After (Cloudflare Cron Triggers)

```
Cloudflare Cron Trigger (built-in)
  → scheduled event handler
    → Business logic

Manual trigger (admin-only):
  → POST /api/scheduled/daily-digest (with session auth)
    → Same business logic
```

### Migration Steps

1. **Extract logic**: Move business logic from Next.js route handler into a standalone function
2. **Add wrangler cron**: Define the schedule in `wrangler.toml`
3. **Add scheduled handler**: Wire up the `scheduled` event in your server entry
4. **Keep HTTP endpoint**: Add an admin-protected manual trigger for testing
5. **Remove external cron**: Delete external scheduler configuration

---

## Cron Expression Reference

| Expression | Schedule |
|-----------|----------|
| `* * * * *` | Every minute |
| `*/15 * * * *` | Every 15 minutes |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 7 * * *` | Daily at 7:00 AM UTC |
| `0 7 * * 1-5` | Weekdays at 7:00 AM UTC |
| `0 0 * * 0` | Weekly on Sunday at midnight |
| `0 0 1 * *` | Monthly on the 1st at midnight |

---

## Benefits

### 1. No External Dependencies
Schedule lives in `wrangler.toml` — no external cron service to configure or maintain.

### 2. Co-Located Code
Scheduled tasks and application code deploy together — no version drift.

### 3. Automatic Retries
Cloudflare retries failed cron triggers automatically.

### 4. Free on All Plans
Cron Triggers are included in all Cloudflare Workers plans at no additional cost.

---

## Trade-offs

### 1. CPU Time Limits
**Downside**: Tasks are subject to Workers CPU limits (10ms free, 300s paid).
**Mitigation**: Break long tasks into smaller chunks. Use Durable Objects for long-running work.

### 2. No Sub-Minute Precision
**Downside**: Minimum interval is 1 minute.
**Mitigation**: Use Durable Objects `alarm()` for sub-minute scheduling.

### 3. UTC Only
**Downside**: Cron expressions use UTC, not local time.
**Mitigation**: Calculate UTC offset for your target timezone.

---

## Anti-Patterns

### ❌ Anti-Pattern: Unprotected HTTP Cron Endpoints

```typescript
// ❌ BAD: No auth on cron endpoint (anyone can trigger it)
POST: async ({ request }) => {
  await handleDailyDigest()  // No auth check!
  return Response.json({ success: true })
}

// ✅ GOOD: Admin-only access
POST: async ({ request }) => {
  const user = await getAuthSession()
  if (!user?.isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })
  await handleDailyDigest()
  return Response.json({ success: true })
}
```

### ❌ Anti-Pattern: Rethrowing Cron Errors

```typescript
// ❌ BAD: Rethrowing crashes the worker
async scheduled(event, env, ctx) {
  await handleDailyDigest(env)  // If this throws, worker crashes
}

// ✅ GOOD: Catch and log
async scheduled(event, env, ctx) {
  try {
    await handleDailyDigest(env)
  } catch (error) {
    console.error('[Cron] Failed:', error)
  }
}
```

---

## Related Patterns

- **[Wrangler Configuration](./tanstack-cloudflare.wrangler-configuration.md)**: Cron triggers configured in wrangler.toml
- **[Email Service](./tanstack-cloudflare.email-service.md)**: Scheduled tasks commonly send emails
- **[Third-Party API Integration](./tanstack-cloudflare.third-party-api-integration.md)**: Token refresh as scheduled task
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Debug endpoints for manual triggers

---

## Checklist for Implementation

- [ ] Cron expressions defined in `wrangler.toml` under `[triggers]`
- [ ] `scheduled` event handler in server entry point
- [ ] Dispatch logic based on `event.cron` string
- [ ] All errors caught and logged (never rethrow)
- [ ] Business logic in standalone functions (not in handler)
- [ ] Admin-protected HTTP endpoint for manual testing
- [ ] Debug mode returns preview without executing
- [ ] `ctx.waitUntil()` used for async work

---

**Status**: Stable - Production-ready scheduled task pattern
**Recommendation**: Use for all periodic background tasks
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
