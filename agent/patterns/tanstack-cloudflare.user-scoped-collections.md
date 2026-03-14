# User-Scoped Collections Pattern

**Category**: Architecture
**Applicable To**: Firestore database design in TanStack Start + Cloudflare Workers applications
**Status**: Stable

---

## Overview

User-scoped collections store data as subcollections under individual user documents. This pattern provides natural data isolation, simplifies security rules, and makes per-user queries efficient. By embedding the user ID in the document path rather than as a field, you eliminate the need for filtering queries and make security rules trivial to implement.

This pattern is essential for multi-tenant applications where each user's data must be completely isolated from other users' data, with the isolation enforced at the database structure level rather than through application logic.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building multi-tenant applications where users have isolated data
- Working with Firestore in TanStack Start + Cloudflare Workers
- Need to enforce data isolation at the database level
- Want simplified security rules (path-based access control)
- Per-user queries are the primary access pattern
- Data naturally belongs to a specific user (conversations, credentials, preferences)

❌ **Don't use this pattern when:**
- Data is shared across multiple users (public content, shared documents)
- Need to query across all users frequently (analytics, admin dashboards)
- Working with relational databases (use user_id foreign keys instead)
- Data doesn't have a clear user ownership

---

## Core Principles

1. **Path-Based User Scoping**: User ID is embedded in the document path, not stored as a field in the document
2. **No user_id Field**: Documents don't need a `user_id` field since the path provides the scope
3. **Provider-Based Organization**: OAuth credentials and integrations organized by provider (instagram, eventbrite, etc.)
4. **Nested Subcollections**: Related data (like messages in conversations) stored as subcollections
5. **Simplified Security Rules**: Firestore security rules can easily enforce user isolation using path variables
6. **Efficient Queries**: Queries are naturally scoped to a user without requiring filters

---

## Implementation

### Structure

```
{BASE}.users/{userId}/
  ├── conversations/{conversationId}
  │   └── messages/{messageId}
  ├── credentials/{provider}
  │   └── current
  ├── oauth-integrations/{provider}
  │   └── current
  ├── preferences/
  │   └── settings
  └── activity/{activityId}
```

### Code Example

#### Step 1: Define Collection Helpers

```typescript
// src/constant/collections.ts
export const BASE = getBasePrefix(); // e.g., 'e0.agentbase' or 'agentbase'

/**
 * Get the conversations collection path for a specific user
 */
export function getUserConversations(userId: string): string {
  return `${BASE}.users/${userId}/conversations`;
}

/**
 * Get the messages collection path for a specific conversation
 */
export function getUserConversationMessages(userId: string, conversationId: string): string {
  return `${BASE}.users/${userId}/conversations/${conversationId}/messages`;
}

/**
 * Get the credentials path for a specific user and provider
 * Pattern: users/{userId}/credentials/{provider}
 */
export function getUserCredentials(userId: string, provider: string): string {
  return `${BASE}.users/${userId}/credentials/${provider}`;
}

/**
 * Get OAuth integration path for a user and provider
 * Pattern: users/{userId}/oauth-integrations/{provider}
 */
export function getUserOAuthIntegration(userId: string, provider: string): string {
  return `${BASE}.users/${userId}/oauth-integrations/${provider}`;
}
```

#### Step 2: Create Zod Schemas (No user_id field)

```typescript
// src/schemas/credentials.ts
import { z } from 'zod';

/**
 * User-Scoped Credentials Schema
 * 
 * Stored at: users/{userId}/credentials/{provider}/current
 * The userId and provider are implicit in the path.
 */
export const InstagramCredentialsSchema = z.object({
  access_token: z.string(),
  instagram_user_id: z.string(),
  instagram_username: z.string().optional(),
  expires_at: z.string().datetime(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Note: No user_id field - it's in the path!
});

export type InstagramCredentials = z.infer<typeof InstagramCredentialsSchema>;
```

```typescript
// src/schemas/oauth-integration.ts
import { z } from 'zod';

/**
 * OAuth Integration Schema (User-Scoped)
 * 
 * Stored at: users/{userId}/oauth-integrations/{provider}/current
 * Tracks OAuth connections that provide access tokens.
 */
export const OAuthIntegrationSchema = z.object({
  connected: z.boolean(),
  connected_at: z.string().datetime(),
  disconnected_at: z.string().datetime().optional(),
  
  // OAuth-specific
  requires_refresh: z.boolean(),
  refresh_interval_days: z.number().optional(),
  last_refreshed_at: z.string().datetime().optional(),
  next_refresh_at: z.string().datetime().optional(),
  
  // Metadata
  provider_user_id: z.string().optional(),
  provider_username: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  // Note: No user_id field - it's in the path!
});

export type OAuthIntegration = z.infer<typeof OAuthIntegrationSchema>;
```

#### Step 3: Create Service Layer

```typescript
// src/services/conversation-database.service.ts
import { getDocument, setDocument, queryDocuments } from '@prmichaelsen/firebase-admin-sdk-v8'
import { getUserConversations, getUserConversationMessages } from '@/constant/collections'
import { ConversationSchema, MessageSchema } from '@/schemas/chat'

export class ConversationDatabaseService {
  /**
   * Get messages for a specific conversation
   */
  static async getMessages(
    userId: string,
    conversationId: string,
    limit = 50,
    startAfter?: string
  ): Promise<Message[]> {
    const collectionPath = getUserConversationMessages(userId, conversationId)
    
    const results = await queryDocuments(collectionPath, {
      orderBy: [{ field: 'created_at', direction: 'DESCENDING' }],
      limit,
      startAfter: startAfter ? [{ field: 'created_at', value: startAfter }] : undefined,
    })
    
    return results.map(doc => MessageSchema.parse(doc.data))
  }
  
  /**
   * Add a message to a conversation
   */
  static async addMessage(
    userId: string,
    conversationId: string,
    messageData: Omit<Message, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Message> {
    const collectionPath = getUserConversationMessages(userId, conversationId)
    const messageId = crypto.randomUUID()
    
    const message: Message = {
      ...messageData,
      id: messageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Note: No user_id field needed!
    }
    
    await setDocument(collectionPath, messageId, message)
    return message
  }
}
```

---

## Examples

### Example 1: OAuth Callback Saving Credentials

```typescript
// src/routes/api/auth/instagram/callback.ts
import { getServerSession } from '@/lib/auth/session'
import { setDocument } from '@prmichaelsen/firebase-admin-sdk-v8'
import { getUserCredentials, getUserOAuthIntegration } from '@/constant/collections'

export const APIRoute = createAPIFileRoute('/api/auth/instagram/callback')({
  GET: async ({ request }) => {
    const session = await getServerSession(request)
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Exchange code for token...
    const { accessToken, expiresIn, instagramUserId } = await exchangeCodeForToken(code)
    
    // Save credentials (user-scoped)
    const credentialsPath = getUserCredentials(session.user.uid, 'instagram')
    await setDocument(credentialsPath, 'current', {
      access_token: accessToken,
      instagram_user_id: instagramUserId.toString(),
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // No user_id field!
    })
    
    // Save OAuth integration status (user-scoped)
    const integrationPath = getUserOAuthIntegration(session.user.uid, 'instagram')
    await setDocument(integrationPath, 'current', {
      connected: true,
      connected_at: new Date().toISOString(),
      requires_refresh: true,
      refresh_interval_days: 50,
      provider_user_id: instagramUserId.toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // No user_id field!
    })
    
    return Response.redirect('/integrations')
  }
})
```

### Example 2: Querying User's Conversations

```typescript
// src/services/conversation-database.service.ts
export class ConversationDatabaseService {
  static async getUserConversations(userId: string): Promise<Conversation[]> {
    // Query is naturally scoped to user - no filtering needed!
    const collectionPath = getUserConversations(userId)
    
    const results = await queryDocuments(collectionPath, {
      orderBy: [{ field: 'updated_at', direction: 'DESCENDING' }],
      limit: 50,
    })
    
    return results.map(doc => ConversationSchema.parse(doc.data))
  }
}
```

### Example 3: Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User-scoped conversations
    match /{environment}.users/{userId}/conversations/{conversationId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // User-scoped messages
    match /{environment}.users/{userId}/conversations/{conversationId}/messages/{messageId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // User-scoped credentials
    match /{environment}.users/{userId}/credentials/{provider}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // User-scoped OAuth integrations
    match /{environment}.users/{userId}/oauth-integrations/{provider}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

## Benefits

### 1. Natural Data Isolation

All data is naturally scoped to a user with no risk of cross-user data leakage:

```typescript
// All data naturally scoped to user
const messages = await ConversationDatabaseService.getMessages(userId, conversationId)
// Impossible to accidentally access another user's data
```

### 2. Simplified Security Rules

Security rules are trivial - just check if `request.auth.uid == userId`:

```javascript
// Simple, clear security rule
match /{environment}.users/{userId}/conversations/{conversationId} {
  allow read, write: if request.auth.uid == userId;
}
```

### 3. Efficient Queries

Queries are naturally scoped to a user without requiring filters:

```typescript
// No filtering needed - path provides scope
const conversations = await queryDocuments(
  getUserConversations(userId),
  { orderBy: [{ field: 'updated_at', direction: 'DESCENDING' }] }
)
```

### 4. Clean Data Model

Documents don't need redundant `user_id` fields:

```typescript
// Clean schema - no user_id field
interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  created_at: string
  // No user_id field!
}
```

### 5. Scalable Architecture

Firestore can efficiently index and query within user subcollections, making this pattern scale well.

---

## Trade-offs

### 1. Cross-User Queries Are Difficult

**Downside**: Querying across all users (e.g., for analytics or admin dashboards) requires collection group queries or denormalization.

**Mitigation**: 
- Use collection group queries for cross-user analytics
- Denormalize data into global collections for admin views
- Use separate analytics database for cross-user reporting

### 2. Data Migration Complexity

**Downside**: Migrating from global collections to user-scoped requires rewriting paths for all documents.

**Mitigation**:
- Plan data structure carefully upfront
- Use migration scripts to automate path changes
- Consider dual-write during migration period

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Storing user_id in User-Scoped Documents

**Description**: Adding a redundant `user_id` field to documents that are already user-scoped by path.

**Why it's bad**: Redundant data that can become inconsistent, wastes storage, violates DRY principle.

**Instead, do this**: Omit the `user_id` field - the path provides the scope.

```typescript
// ❌ Bad - redundant user_id field
await setDocument(getUserCredentials(userId, 'instagram'), 'current', {
  user_id: userId,  // Redundant! Already in path
  access_token: token,
})

// ✅ Good - no user_id field
await setDocument(getUserCredentials(userId, 'instagram'), 'current', {
  access_token: token,
  // No user_id field needed
})
```

### ❌ Anti-Pattern 2: Using Global Collections for User Data

**Description**: Storing user-specific data in global collections with `user_id` filters.

**Why it's bad**: Requires filtering every query, complex security rules, risk of data leakage.

**Instead, do this**: Use user-scoped subcollections.

```typescript
// ❌ Bad - global collection with filtering
const credentials = await queryDocuments('credentials', {
  where: [
    { field: 'user_id', op: 'EQUAL', value: userId },
    { field: 'provider', op: 'EQUAL', value: 'instagram' }
  ]
})

// ✅ Good - user-scoped collection
const credentialsPath = getUserCredentials(userId, 'instagram')
const credentials = await getDocument(credentialsPath, 'current')
```

### ❌ Anti-Pattern 3: Mixing Scoping Patterns

**Description**: Using user-scoped collections for some data and global collections for other user data.

**Why it's bad**: Inconsistent patterns make codebase harder to understand and maintain.

**Instead, do this**: Be consistent - use user-scoped collections for all user data.

```typescript
// ❌ Bad - inconsistent patterns
const conversations = getUserConversations(userId)  // User-scoped ✓
const credentials = 'credentials'  // Global ✗

// ✅ Good - consistent patterns
const conversations = getUserConversations(userId)  // User-scoped ✓
const credentials = getUserCredentials(userId, provider)  // User-scoped ✓
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('User-Scoped Collections', () => {
  it('should isolate data by user', async () => {
    const user1Messages = await ConversationDatabaseService.getMessages('user1', 'conv1')
    const user2Messages = await ConversationDatabaseService.getMessages('user2', 'conv1')
    
    // Same conversation ID, different users = different data
    expect(user1Messages).not.toEqual(user2Messages)
  })
  
  it('should not require user_id in document', async () => {
    const message = await ConversationDatabaseService.addMessage('user1', 'conv1', {
      content: 'Hello',
      role: 'user',
    })
    
    expect(message).not.toHaveProperty('user_id')
  })
})
```

### Integration Tests

```typescript
describe('Firestore Security Rules', () => {
  it('should prevent cross-user access', async () => {
    // User1 tries to access User2's data
    await expect(
      getDocument(getUserConversations('user2'), 'conv1', { auth: user1Auth })
    ).rejects.toThrow('Permission denied')
  })
  
  it('should allow user to access own data', async () => {
    const doc = await getDocument(
      getUserConversations('user1'), 
      'conv1', 
      { auth: user1Auth }
    )
    
    expect(doc).toBeDefined()
  })
})
```

---

## Related Patterns

- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: Database services use user-scoped collection paths
- **[SSR Preload Pattern](./tanstack-cloudflare.ssr-preload.md)**: Server-side data fetching with user-scoped collections

---

## Migration Guide

### Step 1: Identify Global Collections

Find collections that store user-specific data with `user_id` fields:

```typescript
// Old pattern - global collection
interface Conversation {
  id: string
  user_id: string  // Field that indicates user ownership
  title: string
  created_at: string
}
```

### Step 2: Create Collection Helper Functions

```typescript
// src/constant/collections.ts
export function getUserConversations(userId: string): string {
  return `${BASE}.users/${userId}/conversations`;
}
```

### Step 3: Update Schemas (Remove user_id)

```typescript
// New pattern - user-scoped
interface Conversation {
  id: string
  // No user_id field!
  title: string
  created_at: string
}
```

### Step 4: Migrate Data

```typescript
// Migration script
async function migrateConversations() {
  const oldConversations = await queryDocuments('conversations', {})
  
  for (const doc of oldConversations) {
    const { id, user_id, ...data } = doc.data
    const newPath = getUserConversations(user_id)
    await setDocument(newPath, id, data)
  }
  
  console.log(`Migrated ${oldConversations.length} conversations`)
}
```

### Step 5: Update Service Layer

```typescript
// Update services to use new paths
export class ConversationDatabaseService {
  static async getUserConversations(userId: string): Promise<Conversation[]> {
    // Old: queryDocuments('conversations', { where: [{ field: 'user_id', ... }] })
    // New: queryDocuments(getUserConversations(userId), {})
    const collectionPath = getUserConversations(userId)
    return await queryDocuments(collectionPath, {})
  }
}
```

### Step 6: Update Security Rules

```javascript
// Old rules - complex filtering
match /conversations/{conversationId} {
  allow read, write: if resource.data.user_id == request.auth.uid;
}

// New rules - simple path-based
match /{environment}.users/{userId}/conversations/{conversationId} {
  allow read, write: if request.auth.uid == userId;
}
```

---

## References

- [Firestore Data Model Best Practices](https://firebase.google.com/docs/firestore/data-model)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [firebase-admin-sdk-v8 Documentation](https://github.com/prmichaelsen/firebase-admin-sdk-v8)
- [Hierarchical Data in Firestore](https://firebase.google.com/docs/firestore/data-model#hierarchical-data)

---

## Checklist for Implementation

- [ ] Collection helper functions created for all user-scoped collections
- [ ] Zod schemas don't include `user_id` field
- [ ] Service layer uses collection helpers
- [ ] Firestore security rules use path-based access control
- [ ] No direct path strings in service methods
- [ ] All user data uses user-scoped collections
- [ ] Migration script created (if migrating from global collections)
- [ ] Tests verify data isolation between users
- [ ] Tests verify security rules work correctly

---

**Status**: Stable - Proven pattern for Firestore in TanStack Start applications
**Recommendation**: Use for all user-specific data in Firestore
**Last Updated**: 2026-02-21
**Contributors**: Patrick Michaelsen
