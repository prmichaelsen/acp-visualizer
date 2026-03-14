# Third-Party API Integration Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications integrating with external APIs
**Status**: Stable

---

## Overview

This pattern provides a structured approach for wrapping external APIs (property management systems, payment processors, search services, etc.) into modular, maintainable service modules. Each integration follows a consistent architecture: an auth/token module, an API client, domain-specific service methods, a type definitions file, and a barrel export.

The pattern ensures that external API complexity is contained within dedicated modules, with clean interfaces exposed to the rest of the application. It handles OAuth token lifecycle, sync operations, webhook processing, and error handling consistently across all integrations.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Integrating with external REST APIs (Guesty, Stripe, Algolia, Mailchimp, etc.)
- External API requires OAuth token management or API key rotation
- Need to sync external data into your database
- Processing webhooks from external services
- Multiple parts of your app consume the same external API

❌ **Don't use this pattern when:**
- Calling a single external endpoint once (inline fetch is fine)
- Using an SDK that already provides a clean interface
- The integration is purely client-side (e.g., Google Maps JS API)

---

## Core Principles

1. **Modular File Structure**: Each integration gets its own directory with consistent file organization
2. **Barrel Exports**: Single `index.ts` entry point per integration
3. **Separated Concerns**: Auth, API client, domain services, types, and sync are separate files
4. **Token Lifecycle Management**: Token storage, refresh, and expiration handled in dedicated module
5. **Upsert Pattern for Sync**: External data synced via check-exists → update-or-create
6. **Sync Logging**: All sync operations logged to a dedicated collection for debugging
7. **Non-Blocking Errors**: Integration failures logged but don't crash the calling code

---

## Implementation

### Structure

```
src/lib/
└── {integration}/
    ├── index.ts            # Barrel exports
    ├── types.ts            # External API type definitions
    ├── auth.ts             # OAuth/token management
    ├── api-client.ts       # HTTP client wrapper
    ├── token-storage.ts    # Token persistence (Firestore/KV)
    ├── {domain}.ts         # Domain service (listings, reservations, etc.)
    ├── sync.ts             # Data sync logic
    └── webhooks.ts         # Webhook handler
```

### Code Example

#### Step 1: Define Types

```typescript
// src/lib/guesty/types.ts

export interface GuestyListing {
  _id: string
  title: string
  nickname: string
  address: {
    full: string
    city: string
    state: string
    zipcode: string
    lat: number
    lng: number
  }
  bedrooms: number
  bathrooms: number
  accommodates: number
  picture: { thumbnail: string; regular: string }
  prices: { basePrice: number; currency: string }
  active: boolean
}

export interface GuestyReservation {
  _id: string
  listingId: string
  guestName: string
  checkIn: string
  checkOut: string
  status: 'confirmed' | 'cancelled' | 'checked_in' | 'checked_out'
  money: { totalPrice: number; currency: string }
}

export interface GuestyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}
```

#### Step 2: Auth / Token Management

```typescript
// src/lib/guesty/auth.ts

import { GuestyTokenStorage } from './token-storage'
import type { GuestyTokenResponse } from './types'

export class GuestyAuthService {
  private static tokenEndpoint = 'https://open-api.guesty.com/oauth2/token'

  /**
   * Get a valid access token, refreshing if needed
   */
  static async getAccessToken(): Promise<string> {
    // Check stored token
    const stored = await GuestyTokenStorage.get()
    if (stored && !this.isExpired(stored)) {
      return stored.access_token
    }

    // Refresh token
    return this.refreshToken()
  }

  /**
   * Refresh the OAuth token
   */
  static async refreshToken(): Promise<string> {
    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.GUESTY_CLIENT_ID!,
        client_secret: process.env.GUESTY_CLIENT_SECRET!,
      }),
    })

    if (!response.ok) {
      throw new Error(`Guesty token refresh failed: ${response.status}`)
    }

    const data: GuestyTokenResponse = await response.json()
    await GuestyTokenStorage.store({
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000,
    })

    return data.access_token
  }

  private static isExpired(token: { expires_at: number }): boolean {
    return Date.now() > token.expires_at - 60_000 // 1 minute buffer
  }
}
```

#### Step 3: API Client

```typescript
// src/lib/guesty/api-client.ts

import { GuestyAuthService } from './auth'

export class GuestyApiClient {
  private static baseUrl = 'https://open-api.guesty.com/v1'

  /**
   * Make an authenticated request to the Guesty API
   */
  static async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await GuestyAuthService.getAccessToken()

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Guesty API error ${response.status}: ${error}`)
    }

    return response.json()
  }

  static async get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  static async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }
}
```

#### Step 4: Domain Service

```typescript
// src/lib/guesty/listings.ts

import { GuestyApiClient } from './api-client'
import type { GuestyListing } from './types'

export class GuestyListingsService {
  /**
   * Fetch all active listings from Guesty
   */
  static async getListings(limit = 100): Promise<GuestyListing[]> {
    const data = await GuestyApiClient.get<{ results: GuestyListing[] }>(
      `/listings?limit=${limit}&fields=title,nickname,address,bedrooms,bathrooms,accommodates,picture,prices,active`
    )
    return data.results.filter(l => l.active)
  }

  /**
   * Fetch a single listing by ID
   */
  static async getListing(id: string): Promise<GuestyListing> {
    return GuestyApiClient.get<GuestyListing>(`/listings/${id}`)
  }
}
```

#### Step 5: Sync Service

```typescript
// src/lib/guesty/sync.ts

import { GuestyListingsService } from './listings'
import { GuestyReservationsService } from './reservations'
import { PropertyDatabaseService } from '@/services/property-database.service'
import { ReservationDatabaseService } from '@/services/reservation-database.service'

interface SyncResult {
  properties: { updated: number; created: number; errors: number }
  reservations: { updated: number; created: number; errors: number }
  syncedAt: string
}

export class GuestySyncService {
  /**
   * Full sync: pull all listings and reservations from Guesty
   */
  static async fullSync(): Promise<SyncResult> {
    console.log('[GuestySync] Starting full sync...')

    // Sync properties
    const listings = await GuestyListingsService.getListings()
    const propResult = await this.syncProperties(listings)

    // Sync reservations
    const reservations = await GuestyReservationsService.getReservations()
    const resResult = await this.syncReservations(reservations)

    const result: SyncResult = {
      properties: propResult,
      reservations: resResult,
      syncedAt: new Date().toISOString(),
    }

    // Log sync results
    await this.logSync(result)
    console.log('[GuestySync] Complete:', result)

    return result
  }

  /**
   * Upsert pattern: check if exists, update or create
   */
  private static async syncProperties(listings: GuestyListing[]) {
    let updated = 0, created = 0, errors = 0

    for (const listing of listings) {
      try {
        const existing = await PropertyDatabaseService.getByExternalId(listing._id)
        const mapped = this.mapListingToProperty(listing)

        if (existing) {
          await PropertyDatabaseService.update(existing.id, mapped)
          updated++
        } else {
          await PropertyDatabaseService.create(mapped)
          created++
        }
      } catch (error) {
        console.error(`[GuestySync] Failed to sync listing ${listing._id}:`, error)
        errors++
      }
    }

    return { updated, created, errors }
  }

  private static mapListingToProperty(listing: GuestyListing) {
    return {
      external_id: listing._id,
      external_source: 'guesty',
      title: listing.title,
      address: listing.address.full,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      capacity: listing.accommodates,
      image_url: listing.picture?.regular,
      base_price: listing.prices?.basePrice,
      currency: listing.prices?.currency,
      updated_at: new Date().toISOString(),
    }
  }

  private static async logSync(result: SyncResult): Promise<void> {
    // Store sync log for debugging and audit trail
    await SyncLogDatabaseService.create({
      source: 'guesty',
      result,
      created_at: new Date().toISOString(),
    })
  }
}
```

#### Step 6: Barrel Export

```typescript
// src/lib/guesty/index.ts

export { GuestyAuthService } from './auth'
export { GuestyApiClient } from './api-client'
export { GuestyListingsService } from './listings'
export { GuestyReservationsService } from './reservations'
export { GuestySyncService } from './sync'
export { GuestyWebhooksService } from './webhooks'
export { GuestyTokenStorage } from './token-storage'
export type * from './types'
```

#### Step 7: Webhook Handler

```typescript
// routes/api/webhooks/guesty.tsx
import { createFileRoute } from '@tanstack/react-router'
import { GuestyWebhooksService } from '@/lib/guesty'

export const Route = createFileRoute('/api/webhooks/guesty')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const signature = request.headers.get('x-guesty-signature')

          // Verify webhook signature
          if (!GuestyWebhooksService.verifySignature(body, signature)) {
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Process webhook
          await GuestyWebhooksService.handleWebhook(body)

          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Webhook] Guesty webhook error:', error)
          // Return 200 to prevent webhook retries for processing errors
          return new Response(JSON.stringify({ received: true, error: 'Processing failed' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
```

---

## Integration Checklist Template

For each new integration, create:

| File | Purpose |
|------|---------|
| `types.ts` | External API response types |
| `auth.ts` | Token management (OAuth, API keys) |
| `api-client.ts` | Authenticated HTTP client |
| `token-storage.ts` | Token persistence |
| `{domain}.ts` | Domain-specific operations |
| `sync.ts` | Data synchronization (if needed) |
| `webhooks.ts` | Webhook processing (if needed) |
| `index.ts` | Barrel exports |

---

## Benefits

### 1. Contained Complexity
All integration logic lives in one directory — easy to find, modify, or remove.

### 2. Consistent Pattern
Every integration follows the same structure — onboarding new integrations is predictable.

### 3. Token Lifecycle Managed
Token refresh, expiration, and storage are handled transparently by the auth module.

### 4. Testable
Each module can be unit tested independently. API client can be mocked for service tests.

---

## Trade-offs

### 1. Boilerplate per Integration
**Downside**: Each integration requires 5-8 files.
**Mitigation**: The structure is consistent and can be scaffolded. Complexity is proportional to the API's complexity.

### 2. No SDK Reuse
**Downside**: Custom API clients instead of official SDKs.
**Mitigation**: Some SDKs don't work in Workers (Node.js-specific). Custom clients give full control over auth and error handling.

---

## Anti-Patterns

### ❌ Anti-Pattern: Inline API Calls

```typescript
// ❌ BAD: Guesty calls scattered across codebase
const token = await fetch('https://open-api.guesty.com/oauth2/token', { ... })
const listings = await fetch('https://open-api.guesty.com/v1/listings', {
  headers: { Authorization: `Bearer ${token}` }
})

// ✅ GOOD: Use integration module
import { GuestyListingsService } from '@/lib/guesty'
const listings = await GuestyListingsService.getListings()
```

### ❌ Anti-Pattern: Swallowing Webhook Errors Silently

```typescript
// ❌ BAD: No logging on webhook failure
POST: async ({ request }) => {
  try { await processWebhook(body) } catch {}
  return Response.json({ received: true })
}

// ✅ GOOD: Log errors, still return 200
POST: async ({ request }) => {
  try { await processWebhook(body) } catch (error) {
    console.error('[Webhook] Processing failed:', error)
  }
  return Response.json({ received: true })
}
```

---

## Related Patterns

- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: Database services consume synced data
- **[Scheduled Tasks](./tanstack-cloudflare.scheduled-tasks.md)**: Token refresh and sync as cron jobs
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Webhook endpoints as API routes
- **[Zod Schema Validation](./tanstack-cloudflare.zod-schema-validation.md)**: Validate external API responses

---

## Checklist for Implementation

- [ ] Dedicated directory per integration (`src/lib/{integration}/`)
- [ ] `types.ts` with external API response types
- [ ] `auth.ts` with token management
- [ ] `api-client.ts` with authenticated HTTP wrapper
- [ ] `token-storage.ts` for token persistence
- [ ] Domain service files for specific operations
- [ ] `sync.ts` for data synchronization (if applicable)
- [ ] `webhooks.ts` for webhook handling (if applicable)
- [ ] `index.ts` barrel export
- [ ] Sync operations use upsert pattern
- [ ] Sync results logged to dedicated collection
- [ ] Webhook endpoints return 200 even on processing errors
- [ ] Token refresh handles expiration with buffer time

---

**Status**: Stable - Proven pattern for external API integrations
**Recommendation**: Use for all external API integrations beyond trivial single-endpoint calls
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
