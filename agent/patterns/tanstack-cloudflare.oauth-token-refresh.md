# OAuth Token Refresh Queue

**Category**: Architecture
**Applicable To**: Proactive OAuth credential rotation with cron-driven queue processing and per-provider refresh logic
**Status**: Stable

---

## Overview

A Firestore-backed queue system for proactive OAuth token refresh. After OAuth callback, credentials are enqueued with a `next_refresh_at` timestamp (e.g., 10 minutes before expiry). A cron job queries the queue for expiring entries, performs per-provider token rotation (Google refresh_token exchange, Instagram stateless refresh), updates credentials, and re-enqueues with the next refresh time.

---

## Implementation

**File**: `src/services/oauth-refresh.service.ts`

### Queue Entry

```typescript
interface RefreshQueueEntry {
  user_id: string
  provider: string
  next_refresh_at: string    // ISO timestamp
  created_at: string
  updated_at: string
}
// Collection: oauth-refresh-queue
// Document ID: {userId}_{provider}
```

### Service Methods

```typescript
class OAuthRefreshService {
  // Called after OAuth callback — schedule first refresh
  static async enqueueRefresh(userId, provider, nextRefreshAt): Promise<void>

  // Called on disconnect — remove from queue
  static async dequeueRefresh(userId, provider): Promise<void>

  // Called by cron — process all expiring credentials
  static async refreshExpiringCredentials(): Promise<RefreshResult[]>
}
```

### Cron Processing Flow

```
Cron trigger (every minute)
  → Query: oauth-refresh-queue WHERE next_refresh_at <= now (limit 100)
  → For each entry:
      ├─ Load credentials from users/{userId}/credentials/{provider}
      ├─ Per-provider refresh:
      │   ├─ Google/YouTube: POST oauth2.googleapis.com/token with refresh_token
      │   └─ Instagram: GET graph.instagram.com/refresh_access_token
      ├─ Save new credentials (access_token, expires_at)
      ├─ Update integration timestamps (last_refreshed_at, next_refresh_at)
      └─ Re-enqueue with new next_refresh_at
```

### Per-Provider Timing

| Provider | Refresh Timing | Token Lifetime |
|---|---|---|
| Google/YouTube | `expiresIn - 600s` (10 min before) | ~1 hour |
| Instagram | 50 days | 60 days |

### Error Handling

- Expired/revoked tokens: dequeue + return `{ status: 'failed' }`
- HTTP errors: log + return `{ status: 'failed', error: httpStatus }`
- Network errors: log + return `{ status: 'failed' }` (retried next cron cycle)

---

## Checklist

- [ ] OAuth callback enqueues refresh with provider-specific timing
- [ ] Disconnect dequeues the entry
- [ ] Cron processes max 100 entries per cycle
- [ ] Failed refreshes are dequeued (user must re-authenticate)
- [ ] Successful refreshes re-enqueue with next timing

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
