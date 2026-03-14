# Firebase Firestore

**Category**: Code
**Applicable To**: All Firestore CRUD operations, DatabaseService classes, collection path helpers, query patterns, and SSR/API data access
**Status**: Stable

---

## Overview

This pattern covers how Firestore is used via `@prmichaelsen/firebase-admin-sdk-v8` for all database operations: initialization, CRUD via static DatabaseService classes, centralized collection path helpers, query building (where, orderBy, pagination, chunked `in`), Zod validation on all reads, and the two contexts where Firestore is accessed (API route handlers and SSR `beforeLoad`). There are 37+ DatabaseService classes following this pattern.

---

## When to Use This Pattern

**Use this pattern when:**
- Creating a new DatabaseService for a Firestore entity
- Adding CRUD operations to an existing service
- Writing queries with filters, ordering, or pagination
- Accessing Firestore in API routes or SSR `beforeLoad`
- Adding new collection paths

**Don't use this pattern when:**
- Building client-side API wrappers (use `{Domain}Service` — see library-services.md)
- Working with Firebase Storage (see `tanstack-cloudflare.firebase-storage`)
- Working with external databases (Weaviate, Algolia)

---

## Core Principles

1. **Always Initialize**: Call `initFirebaseAdmin()` before any Firestore operation
2. **Always Validate Reads**: Every read uses Zod `safeParse()` — never return raw `any`
3. **Reads Return Null, Writes Throw**: Consistent error handling across all services
4. **ISO Timestamps**: Always `new Date().toISOString()` — never `Date.now()`
5. **Collection Helpers**: Import paths from `@/constant/collections` — never hardcode
6. **Static Methods Only**: No instances — all DatabaseService methods are `static`

---

## Implementation

### SDK Functions

```typescript
import {
  getDocument,       // Read single document by ID
  setDocument,       // Write/overwrite document (supports merge)
  deleteDocument,    // Delete document
  addDocument,       // Add with auto-generated or custom ID
  queryDocuments,    // Query with where, orderBy, limit, startAfter
  updateDocument,    // Atomic field updates (FieldValue operations)
  FieldValue,        // arrayRemove, arrayUnion, delete, serverTimestamp
} from '@prmichaelsen/firebase-admin-sdk-v8'
import type { QueryOptions } from '@prmichaelsen/firebase-admin-sdk-v8'
```

### Collection Path Helpers

**File**: `src/constant/collections.ts`

**Platform-level collections** (no user scoping):

```typescript
export const USERS = `${BASE}.users`
export const PUBLIC_PROFILES = `${BASE}.public-profiles`
export const RELATIONSHIPS = `${BASE}.relationships`
export const SCHEDULED_MESSAGES = `${BASE}.scheduled-messages`
```

**User-scoped subcollections** (with helper functions):

```typescript
export function getUserProfileCollection(userId: string): string {
  return `${BASE}.users/${userId}/profile`
}

export function getUserConversations(userId: string): string {
  return `${BASE}.users/${userId}/conversations`
}

export function getUserConversationMessages(userId: string, conversationId: string): string {
  return `${BASE}.users/${userId}/conversations/${conversationId}/messages`
}

export function getUserNotificationsCollection(userId: string): string {
  return `${BASE}.users/${userId}/notifications`
}
```

**Shared collections** (multi-user, not user-scoped):

```typescript
export function getSharedConversations(): string {
  return `${BASE}.conversations`
}

export function getSharedConversationMessages(conversationId: string): string {
  return `${BASE}.conversations/${conversationId}/messages`
}
```

### CRUD Operations

#### Read — `getDocument()`

```typescript
static async getProfile(userId: string): Promise<UserProfile | null> {
  try {
    const collection = getUserProfileCollection(userId)
    const doc = await getDocument(collection, PROFILE_DOC_ID)
    if (!doc) return null

    const result = UserProfileSchema.safeParse(doc)
    if (!result.success) {
      console.error('[ProfileDatabaseService] Invalid data:', result.error)
      return null
    }
    return result.data
  } catch (error) {
    console.error('[ProfileDatabaseService] Failed to get:', error)
    return null
  }
}
```

#### Create — `addDocument()`

```typescript
static async createConversation(userId: string, data: CreateConversationInput): Promise<Conversation> {
  const collection = getUserConversations(userId)
  const now = new Date().toISOString()

  const conversation = {
    title: data.title,
    type: data.type ?? 'chat',
    created_at: now,
    updated_at: now,
    message_count: 0,
    last_message_preview: '',
  }

  const docRef = await addDocument(collection, conversation)
  return { id: docRef.id, user_id: userId, ...conversation }
}
```

Optional custom document ID:

```typescript
const docRef = await addDocument(collection, data, customDocumentId)
```

#### Write — `setDocument()` (Full or Merge)

Full overwrite:

```typescript
await setDocument(collection, docId, data)
```

Merge (partial update):

```typescript
await setDocument(collection, conversationId, {
  title,
  updated_at: new Date().toISOString(),
}, { merge: true })
```

Selective merge (recommended for nested objects):

```typescript
await setDocument(collection, conversationId, {
  title,
  updated_at: new Date().toISOString(),
}, { mergeFields: ['title', 'updated_at'] })
```

#### Update — `updateDocument()` (FieldValue operations)

```typescript
import { FieldValue } from '@prmichaelsen/firebase-admin-sdk-v8'

// Remove element from array
await updateDocument(sharedPath, doc.id, {
  participant_user_ids: FieldValue.arrayRemove(userId),
})

// Add element to array (no duplicates)
await updateDocument(collection, docId, {
  tags: FieldValue.arrayUnion('new-tag'),
})
```

#### Delete — `deleteDocument()`

```typescript
static async deleteProfile(userId: string): Promise<void> {
  const collection = getUserProfileCollection(userId)
  await deleteDocument(collection, PROFILE_DOC_ID)
}
```

### Query Patterns

#### Simple WHERE

```typescript
const docs = await queryDocuments(collection, {
  where: [{ field: 'status', op: '==', value: 'pending' }],
})
```

#### WHERE + ORDER + LIMIT

```typescript
const options: QueryOptions = {
  where: [
    { field: 'status', op: '==', value: 'pending' },
    { field: 'scheduled_at', op: '<=', value: cutoffTime },
  ],
  orderBy: [{ field: 'scheduled_at', direction: 'ASCENDING' }],
  limit: 10,
}

const docs = await queryDocuments(SCHEDULED_MESSAGES, options)
```

#### Cursor Pagination with `startAfter`

```typescript
const options: QueryOptions = {
  orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
  limit,
}
if (startAfter) options.startAfter = [startAfter]

const results = await queryDocuments(messagesCollection, options)
```

#### Chunked `in` Queries (30-item limit)

Firestore `in` operator supports max 30 values. Chunk and parallelize:

```typescript
const chunks: string[][] = []
for (let i = 0; i < ids.length; i += 30) {
  chunks.push(ids.slice(i, i + 30))
}

const results = await Promise.all(
  chunks.map(async (chunk) => {
    const docs = await queryDocuments(collection, {
      where: [{ field: 'message_id', op: 'in', value: chunk }],
      orderBy: [{ field: 'sequence_number', direction: 'ASCENDING' }],
    })
    return docs.map(doc => ({ id: doc.id, ...doc.data }))
  })
)

const all = results.flat()
```

#### Simulated OR (Multiple Queries + Merge)

Firestore has no OR operator. Run separate queries and merge:

```typescript
// Query 1: Public messages (visible_to_user_ids is null)
const publicDocs = await queryDocuments(messagesCollection, {
  orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
  limit,
  where: [{ field: 'visible_to_user_ids', op: '==', value: null }],
})

// Query 2: Messages visible to this user
const privateDocs = await queryDocuments(messagesCollection, {
  orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
  limit,
  where: [{ field: 'visible_to_user_ids', op: 'array-contains', value: userId }],
})

// Merge, dedupe, re-sort
const merged = [...publicDocs, ...privateDocs]
const deduped = Array.from(new Map(merged.map(d => [d.id, d])).values())
const sorted = deduped.sort((a, b) =>
  new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime()
).slice(0, limit)
```

### Query Result Parsing

Always validate query results with Zod and filter invalid documents:

```typescript
const results = await queryDocuments(collection, options)

const valid = results
  .map(doc => {
    const result = EntitySchema.safeParse({ ...doc.data, id: doc.id })
    if (!result.success) {
      console.error('[ServiceName] Invalid data:', result.error)
      return null
    }
    return result.data
  })
  .filter((item): item is Entity => item !== null)
```

### Document ID Patterns

| Strategy | Example | Use Case |
|---|---|---|
| Fixed ID | `'default'`, `'current'` | Singleton documents (profile, subscription, usage) |
| Provider-keyed | `'instagram'`, `'github'` | One doc per OAuth provider |
| Composite | `${userId}_${memoryId}` | Cross-entity lookups |
| Auto-generated | `addDocument(coll, data)` | Most entities (conversations, messages, notifications) |

### Firestore in SSR vs API Routes

#### SSR `beforeLoad`

```typescript
export const Route = createFileRoute('/some-page')({
  beforeLoad: (async () => {
    const user = await getAuthSession()
    if (!user) throw redirect({ to: '/auth' })

    let preloadData = null
    if (typeof window === 'undefined') {
      initFirebaseAdmin()
      preloadData = await SomeDatabaseService.getData(user.uid)
    }

    return { initialUser: user, preloadData }
  }) as any,
})
```

#### API Routes

```typescript
GET: async () => {
  initFirebaseAdmin()

  const user = await getAuthSession()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  const data = await SomeDatabaseService.getData(user.uid)
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

#### Fire-and-Forget (Non-Critical Operations)

```typescript
// Don't block page load on optional operations
ProfileViewDatabaseService.trackProfileView(user.uid, targetUserId).catch(() => {})

// Dynamic import for optional services
import('./algolia.service').then(({ AlgoliaService }) =>
  AlgoliaService.syncToIndex(id, data)
).catch(() => {})
```

### Denormalization Patterns

#### Bidirectional Index

Write index entries for both users in a relationship:

```typescript
const index1 = getUserRelationshipIndexCollection(userId1)
const index2 = getUserRelationshipIndexCollection(userId2)

await setDocument(index1, userId2, { related_user_id: userId2, relationship_id: id, flags })
await setDocument(index2, userId1, { related_user_id: userId1, relationship_id: id, flags })
```

#### Bulk Delete with Pagination

```typescript
let hasMore = true
while (hasMore) {
  const docs = await queryDocuments(collectionPath, { limit: 500 })
  for (const doc of docs) {
    await deleteDocument(collectionPath, doc.id)
  }
  hasMore = docs.length === 500
}
```

### Complex Object Serialization

Firestore doesn't support deeply nested arbitrary objects well. Serialize complex inputs:

```typescript
const toolCallData = {
  tool_name: toolCall.tool_name,
  timestamp: toolCall.timestamp.toISOString(),
  // Serialize to prevent nested object issues
  inputs: typeof toolCall.inputs === 'string'
    ? toolCall.inputs
    : JSON.stringify(toolCall.inputs),
  output: typeof toolCall.output === 'string'
    ? toolCall.output
    : JSON.stringify(toolCall.output),
}
```

---

## Anti-Patterns

### Returning Unvalidated Data

```typescript
// Bad: Returns raw Firestore data as any
const doc = await getDocument(collection, id)
return doc

// Good: Always validate with Zod
const result = EntitySchema.safeParse(doc)
if (!result.success) return null
return result.data
```

### Hardcoded Collection Paths

```typescript
// Bad
const doc = await getDocument('agentbase.users/' + userId + '/profile', 'default')

// Good
const collection = getUserProfileCollection(userId)
const doc = await getDocument(collection, PROFILE_DOC_ID)
```

### Using `merge: true` with Nested Objects

```typescript
// Bad: Can cause wildcard field issues with nested objects
await setDocument(coll, id, { nested: { a: 1 } }, { merge: true })

// Good: Use mergeFields for explicit control
await setDocument(coll, id, { nested: { a: 1 } }, { mergeFields: ['nested'] })
```

### Unbounded Queries

```typescript
// Bad: Could return millions of documents
const all = await queryDocuments(collection, {})

// Good: Always limit
const docs = await queryDocuments(collection, { limit: 500 })
```

### Numeric Timestamps

```typescript
// Bad
const now = Date.now()

// Good
const now = new Date().toISOString()
```

### `in` Queries Over 30 Items

```typescript
// Bad: Firestore rejects in queries with >30 values
const docs = await queryDocuments(coll, {
  where: [{ field: 'id', op: 'in', value: hundredIds }],
})

// Good: Chunk into batches of 30
const chunks = []
for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30))
const results = await Promise.all(chunks.map(chunk =>
  queryDocuments(coll, { where: [{ field: 'id', op: 'in', value: chunk }] })
))
```

---

## Key Design Decisions

### Data Model

| Decision | Choice | Rationale |
|---|---|---|
| User data scoping | User-scoped subcollections | Natural security boundary; collection-group queries still possible |
| DM/group conversations | Shared collection (not user-scoped) | Multiple participants read/write same messages |
| Relationship data | Global + per-user index | Global doc is source of truth; index enables fast per-user queries |
| Document ID strategy | Auto-generated (default), fixed for singletons | Auto-gen prevents conflicts; fixed IDs simplify lookups |

### Query Patterns

| Decision | Choice | Rationale |
|---|---|---|
| OR queries | Multiple queries + merge | Firestore has no OR operator |
| Large `in` queries | Chunk at 30, parallelize | Firestore limit; Promise.all for speed |
| Pagination | Cursor-based (startAfter) | More reliable than offset for real-time data |
| Sort direction | Specified in QueryOptions | Prevents relying on default (undefined) ordering |

### Error Handling

| Decision | Choice | Rationale |
|---|---|---|
| Read errors | Return null / empty array | Callers handle gracefully; page still renders |
| Write errors | Throw | Callers need to know writes failed for user feedback |
| Validation errors | Log + return null | Invalid data in Firestore is non-fatal; logged for debugging |

---

## Checklist for Implementation

- [ ] `initFirebaseAdmin()` called before any Firestore operation
- [ ] Collection path uses helper from `@/constant/collections`
- [ ] All reads validated with Zod `safeParse()` — no raw `doc as Type`
- [ ] Reads return `null` on error; writes throw on error
- [ ] Timestamps use `new Date().toISOString()`
- [ ] Logging uses `[ClassName]` prefix
- [ ] Queries include `limit` to prevent unbounded reads
- [ ] `in` queries chunked at 30 items
- [ ] `mergeFields` used instead of `merge: true` for nested objects
- [ ] New collection paths added to `src/constant/collections.ts`

---

## Related Patterns

- **[Database Service Conventions](./database-service-conventions.md)**: Naming, structure, and testing conventions for DatabaseService classes
- **[Zod Schema Conventions](./zod-schema-conventions.md)**: Schema definitions consumed by DatabaseServices for `safeParse`
- **[Firebase Auth](./tanstack-cloudflare.firebase-auth.md)**: Auth-verified userId flows into all database calls
- **[SSR Preload](./ssr-preload.md)**: SSR `beforeLoad` calls DatabaseServices with `typeof window === 'undefined'` guard
- **[Entity Blueprint](./entity-blueprint.md)**: End-to-end recipe for creating a new entity with schema, service, API, and UI

---

**Status**: Stable
**Recommendation**: Follow this pattern for all Firestore operations. Always use DatabaseService classes — never call SDK functions directly from routes or components.
**Last Updated**: 2026-03-14
**Contributors**: Community
