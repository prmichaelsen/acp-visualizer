# Library Services Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with Firestore/database operations
**Status**: Stable

---

## Overview

All data access operations (API calls, Firestore operations, external services) must go through dedicated service layer libraries. This pattern provides a clear separation between client-side API wrappers and server-side database services, ensuring proper isolation, testability, and maintainability.

The pattern enforces that direct calls from components, routes, or other non-service code are anti-patterns. Instead, all data operations flow through well-defined service classes that handle validation, error logging, and type safety.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building TanStack Start applications with server-side data access
- Working with Firestore or other database operations
- Need to separate client-side and server-side data access logic
- Want to ensure type safety and validation at service boundaries
- Building applications that require testable, mockable data layers
- Need consistent error handling and logging across data operations

❌ **Don't use this pattern when:**
- Building purely static sites with no data access
- Working on trivial prototypes or demos
- The overhead of service layers outweighs benefits (very simple CRUD apps)
- You have no server-side data access requirements

---

## Core Principles

1. **Service Layer Abstraction**: All data operations must be encapsulated in service classes that provide clean APIs for data access
2. **No Direct Database Calls**: Components and routes never call `getDocument`, `setDocument`, or `queryDocuments` directly
3. **No Direct API Calls**: Components never call `fetch('/api/...')` directly - they use API service wrappers
4. **Clear Naming Convention**: Service class names indicate scope - `DatabaseService` for server-side, `Service` for client-side
5. **Same Method Names**: Database and API services use identical method names for consistency
6. **Type Safety**: Services enforce Zod validation and return typed data models
7. **Error Handling**: Services centralize error logging and handling

---

## Implementation

### Structure

```
src/
├── services/
│   ├── {domain}-database.service.ts    # Server-side database operations
│   ├── {domain}.service.ts             # Client-side API wrappers
│   └── ...
├── routes/
│   └── api/
│       └── {domain}/
│           └── index.ts                # API routes use DatabaseService
└── components/
    └── {domain}/
        └── Component.tsx               # Components use Service (API wrapper)
```

### Service Types

#### 1. Database Services (Server-Side)

**Purpose**: Direct Firestore/database operations
**Naming**: `{Domain}DatabaseService`
**File**: `{domain}-database.service.ts`
**Used By**: API routes, beforeLoad, server functions, cron jobs

**Characteristics**:
- Directly calls `getDocument`, `setDocument`, `queryDocuments`
- Server-side only (uses firebase-admin-sdk)
- Handles Zod validation
- Manages timestamps (created_at, updated_at)
- Returns typed data models

#### 2. API Services (Client Wrappers)

**Purpose**: Wrap API endpoint calls for client-side use
**Naming**: `{Domain}Service`
**File**: `{domain}.service.ts`
**Used By**: Components, client-side hooks

**Characteristics**:
- Calls `fetch('/api/...')`
- Client-side safe
- Handles HTTP errors
- Returns typed data models

### Code Example

#### Database Service (Server-Side)

```typescript
// src/services/oauth-integration-database.service.ts
import { getDocument, setDocument } from '@prmichaelsen/firebase-admin-sdk-v8'
import { getUserOAuthIntegration } from '@/constant/collections'
import { OAuthIntegrationSchema, type OAuthIntegration } from '@/schemas/oauth-integration'

export class OAuthIntegrationDatabaseService {
  static async getIntegration(userId: string, provider: string): Promise<OAuthIntegration | null> {
    try {
      const path = getUserOAuthIntegration(userId, provider)
      const doc = await getDocument(path, 'current')
      
      if (!doc) return null
      
      const result = OAuthIntegrationSchema.safeParse(doc)
      if (!result.success) {
        console.error(`Invalid OAuth integration data for ${provider}:`, result.error)
        return null
      }
      
      return result.data
    } catch (error) {
      console.error(`Failed to get OAuth integration for ${provider}:`, error)
      return null
    }
  }

  static async saveIntegration(userId: string, provider: string, data: OAuthIntegrationInput): Promise<void> {
    try {
      const path = getUserOAuthIntegration(userId, provider)
      const now = new Date().toISOString()
      
      const integration: OAuthIntegration = {
        ...data,
        connected_at: now,
        created_at: now,
        updated_at: now,
      }
      
      await setDocument(path, 'current', integration)
      console.log(`[OAuthIntegrationDatabaseService] Saved ${provider} integration for user ${userId}`)
    } catch (error) {
      console.error(`[OAuthIntegrationDatabaseService] Failed to save ${provider} integration:`, error)
      throw error
    }
  }

  static async getUserIntegrations(userId: string, providers: string[]): Promise<Record<string, OAuthIntegration>> {
    const integrations: Record<string, OAuthIntegration> = {}
    
    await Promise.all(
      providers.map(async (provider) => {
        const integration = await this.getIntegration(userId, provider)
        if (integration && integration.connected) {
          integrations[provider] = integration
        }
      })
    )
    
    return integrations
  }
}
```

#### API Service (Client-Side)

```typescript
// src/services/integrations.service.ts
import type { OAuthIntegration } from '@/schemas/oauth-integration'

export class IntegrationsService {
  /**
   * Get user's OAuth integrations (client-side)
   * Calls the API endpoint which validates session server-side
   */
  static async getUserIntegrations(): Promise<Record<string, OAuthIntegration>> {
    try {
      const response = await fetch('/api/integrations/')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`)
      }
      
      const data: any = await response.json()
      return data.integrations || {}
    } catch (error) {
      console.error('[IntegrationsService] Failed to fetch integrations:', error)
      return {}
    }
  }
}
```

---

## Examples

### Example 1: Using API Service in Component (Client-Side)

```typescript
// src/components/integrations/IntegrationsPanel.tsx
import { useEffect, useState } from 'react'
import { IntegrationsService } from '@/services/integrations.service'
import type { OAuthIntegration } from '@/schemas/oauth-integration'

function IntegrationsPanel() {
  const [integrations, setIntegrations] = useState<Record<string, OAuthIntegration>>({})
  
  useEffect(() => {
    // ✅ CORRECT: Use API service wrapper
    IntegrationsService.getUserIntegrations()
      .then(data => setIntegrations(data))
  }, [])
  
  return (
    <div>
      {Object.entries(integrations).map(([provider, integration]) => (
        <div key={provider}>
          {provider}: {integration.connected ? 'Connected' : 'Disconnected'}
        </div>
      ))}
    </div>
  )
}
```

### Example 2: Using Database Service in API Route (Server-Side)

```typescript
// src/routes/api/integrations/index.ts
import { createAPIFileRoute } from '@tanstack/start/api'
import { getServerSession } from '@/lib/auth/session'
import { OAuthIntegrationDatabaseService } from '@/services/oauth-integration-database.service'

export const APIRoute = createAPIFileRoute('/api/integrations')({
  GET: async ({ request }) => {
    const session = await getServerSession(request)
    
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // ✅ CORRECT: Use database service
    const integrations = await OAuthIntegrationDatabaseService.getUserIntegrations(
      session.user.uid,
      ['instagram', 'eventbrite']
    )
    
    return Response.json({ integrations })
  }
})
```

### Example 3: Using Database Service in beforeLoad (Server-Side)

```typescript
// src/routes/integrations.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'
import { OAuthIntegrationDatabaseService } from '@/services/oauth-integration-database.service'

export const Route = createFileRoute('/integrations')({
  beforeLoad: async () => {
    const user = await getAuthSession()
    if (!user) return { initialIntegrations: {} }
    
    // ✅ CORRECT: Use database service in server-side context
    const initialIntegrations = await OAuthIntegrationDatabaseService.getUserIntegrations(
      user.uid,
      ['instagram', 'eventbrite']
    )
    
    return { initialIntegrations }
  },
})
```

---

## Benefits

### 1. Testability

Services can be easily mocked for testing without requiring database connections or external services:

```typescript
// Easy to mock services in tests
jest.mock('@/services/integrations.service')

test('component loads integrations', async () => {
  IntegrationsService.getUserIntegrations.mockResolvedValue({ instagram: {...} })
  // Test component behavior
})
```

### 2. Consistency

All Firestore operations follow the same pattern with consistent error handling, logging, and Zod validation. Changes to database structure or API endpoints only need to be updated in one place.

### 3. Type Safety

Services provide typed interfaces with no `any` types leaking into components. Zod validation at service boundaries ensures data integrity.

### 4. Maintainability

Change database structure in one place, update API endpoints in one place, and easily add caching, retry logic, or other cross-cutting concerns.

### 5. Import Errors Prevent Misuse

Can't accidentally use database service in component - TypeScript import errors will prevent it since database services use server-only imports.

---

## Trade-offs

### 1. Additional Complexity

**Downside**: Adds extra layers and files to the codebase, which can feel like over-engineering for simple applications.

**Mitigation**: Only apply this pattern when complexity justifies it. For very simple CRUD apps, direct database access might be acceptable. Start simple and refactor to this pattern as needs grow.

### 2. Boilerplate Code

**Downside**: Requires creating multiple service files and maintaining parallel API/Database service structures.

**Mitigation**: Use code generation or templates to quickly scaffold new services. The consistency benefits outweigh the initial setup cost.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Direct Firestore Calls in Components

**Description**: Calling `setDocument`, `getDocument`, or `queryDocuments` directly from React components.

**Why it's bad**: Violates separation of concerns, makes testing difficult, couples components to database implementation, can't be used client-side safely.

**Instead, do this**: Use API service wrappers that call API endpoints.

```typescript
// ❌ BAD: Direct Firestore call in component
import { setDocument } from '@prmichaelsen/firebase-admin-sdk-v8'

function MyComponent() {
  const handleSave = async () => {
    await setDocument('users', userId, data) // BAD!
  }
}

// ✅ GOOD: Use service layer
import { UserService } from '@/services/user.service'

function MyComponent() {
  const handleSave = async () => {
    await UserService.updateUser(userId, data) // GOOD!
  }
}
```

### ❌ Anti-Pattern 2: Direct fetch Calls in Components

**Description**: Calling `fetch('/api/...')` directly from components instead of using service wrappers.

**Why it's bad**: Scatters API endpoint knowledge throughout codebase, makes refactoring difficult, no centralized error handling.

**Instead, do this**: Create API service wrappers.

```typescript
// ❌ BAD: Direct fetch in component
function MyComponent() {
  useEffect(() => {
    fetch('/api/integrations') // BAD!
      .then(res => res.json())
      .then(data => setData(data))
  }, [])
}

// ✅ GOOD: Use service layer
import { IntegrationsService } from '@/services/integrations.service'

function MyComponent() {
  useEffect(() => {
    IntegrationsService.getUserIntegrations() // GOOD!
      .then(integrations => setData(integrations))
  }, [])
}
```

### ❌ Anti-Pattern 3: Mixing UI Logic in Services

**Description**: Putting UI concerns (toasts, navigation, etc.) inside service methods.

**Why it's bad**: Services should be pure data operations. UI logic belongs in components.

**Instead, do this**: Return data from services and handle UI in components.

```typescript
// ❌ BAD: Service doing UI logic
export class UserDatabaseService {
  static async saveUser(user: User): Promise<void> {
    await setDocument(...)
    toast.success('User saved!') // UI logic in service!
  }
}

// ✅ GOOD: Service returns data, component handles UI
export class UserDatabaseService {
  static async saveUser(user: User): Promise<void> {
    await setDocument(...)
    // No UI logic
  }
}

// Component handles UI
function MyComponent() {
  const handleSave = async () => {
    await UserDatabaseService.saveUser(user)
    toast.success('User saved!') // UI logic in component
  }
}
```

---

## Testing Strategy

### Unit Testing Services

```typescript
// Test database service with mocked Firestore
jest.mock('@prmichaelsen/firebase-admin-sdk-v8')

describe('OAuthIntegrationDatabaseService', () => {
  it('should get integration', async () => {
    const mockDoc = { connected: true, provider: 'instagram' }
    getDocument.mockResolvedValue(mockDoc)
    
    const result = await OAuthIntegrationDatabaseService.getIntegration('user1', 'instagram')
    
    expect(result).toEqual(mockDoc)
    expect(getDocument).toHaveBeenCalledWith(
      expect.stringContaining('user1'),
      'current'
    )
  })
})
```

### Integration Testing Components

```typescript
// Test component with mocked API service
jest.mock('@/services/integrations.service')

describe('IntegrationsPanel', () => {
  it('should load integrations', async () => {
    IntegrationsService.getUserIntegrations.mockResolvedValue({
      instagram: { connected: true }
    })
    
    render(<IntegrationsPanel />)
    
    await waitFor(() => {
      expect(screen.getByText(/instagram/i)).toBeInTheDocument()
    })
  })
})
```

---

## Related Patterns

- **[User-Scoped Collections](./tanstack-cloudflare.user-scoped-collections.md)**: Database services use user-scoped collection paths for data isolation
- **[SSR Preload Pattern](./tanstack-cloudflare.ssr-preload.md)**: Database services are used in `beforeLoad` for server-side data preloading

---

## Migration Guide

### Step 1: Identify Direct Calls

Search codebase for:
- `setDocument(`
- `getDocument(`
- `queryDocuments(`
- `fetch('/api/`

### Step 2: Create Services

```typescript
// src/services/domain-database.service.ts
export class DomainDatabaseService {
  static async operation(): Promise<Result> {
    // Move database logic here
  }
}

// src/services/domain.service.ts
export class DomainService {
  static async operation(): Promise<Result> {
    // Move API logic here
  }
}
```

### Step 3: Update Callers

```typescript
// Before
await setDocument(path, id, data)

// After (in API route)
await DomainDatabaseService.saveEntity(id, data)

// After (in component)
await DomainService.saveEntity(id, data)
```

### Step 4: Test

- Verify functionality unchanged
- Add unit tests for services
- Mock services in component tests

---

## References

- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [firebase-admin-sdk-v8](https://github.com/prmichaelsen/firebase-admin-sdk-v8)
- [Martin Fowler - Service Layer](https://martinfowler.com/eaaCatalog/serviceLayer.html)

---

## Checklist for Implementation

- [ ] Database services use `{Domain}DatabaseService` naming
- [ ] API services use `{Domain}Service` naming
- [ ] Same method names across both service types
- [ ] No direct `getDocument`/`setDocument` calls outside services
- [ ] No direct `fetch` calls outside services
- [ ] Services handle Zod validation
- [ ] Services log errors appropriately
- [ ] Services return typed data models
- [ ] Unit tests cover service logic
- [ ] Components mock services in tests

---

**Status**: Stable - Proven pattern for TanStack Start + Cloudflare applications
**Recommendation**: Use for all TanStack Start applications with server-side data access
**Last Updated**: 2026-02-21
**Contributors**: Patrick Michaelsen
