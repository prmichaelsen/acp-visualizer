# Zod Schema Validation Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with typed data models
**Status**: Stable

---

## Overview

All data models are defined as Zod schemas in a centralized `src/schemas/` directory. Schemas serve as the single source of truth for data shape, validation, and TypeScript types. Types are derived from schemas using `z.infer<>`, ensuring runtime validation and compile-time types are always in sync.

This pattern ensures data integrity at every boundary: API request bodies are validated on entry, database documents are validated on read, and all types flow from the schema definitions.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building applications with structured data models
- Need runtime validation at system boundaries (API inputs, database reads)
- Want TypeScript types derived from a single source of truth
- Working with Firestore or other schemaless databases
- Need separate schemas for create, update, and read operations

❌ **Don't use this pattern when:**
- Working with trivial data (single primitive values)
- Using an ORM that handles validation (Prisma, Drizzle)
- Performance-critical hot paths where validation overhead matters

---

## Core Principles

1. **Single Source of Truth**: Zod schemas define data shape; TypeScript types are derived, not hand-written
2. **Centralized Schemas Directory**: All schemas live in `src/schemas/`, organized by domain
3. **Separate CRUD Schemas**: Separate schemas for create input, update input, and full entity
4. **Path-Based Documentation**: Schema files document where data is stored (Firestore path in JSDoc)
5. **Safe Parse in Services**: Use `safeParse` (not `parse`) in services to handle invalid data gracefully
6. **No Redundant Fields**: Schemas for user-scoped data don't include `user_id` (it's in the path)

---

## Implementation

### Structure

```
src/schemas/
├── profile.ts               # UserProfile, UpdateProfileInput
├── relationship.ts          # Relationship, RelationshipFlags
├── group-conversation.ts    # GroupConversation, MemberPermissions
├── dm-conversation.ts       # DMConversation
├── credentials.ts           # InstagramCredentials, etc.
├── oauth-integration.ts     # OAuthIntegration
└── mcp-integration.ts       # MCPIntegration
```

### Code Example

#### Step 1: Define Entity Schema

```typescript
// src/schemas/profile.ts
import { z } from 'zod'

/**
 * User Profile Schema
 *
 * Stored at: {BASE}.users/{userId}/profile/default
 * Each user has exactly one profile document.
 */
export const UserProfileSchema = z.object({
  user_id: z.string(),
  display_name: z.string(),
  short_bio: z.string().optional(),
  profile_picture_path: z.string().optional(),
  banner_path: z.string().optional(),
  friend_count: z.number().int().min(0),
  created_at: z.number(),
  updated_at: z.number(),
})

// Derive TypeScript type from schema
export type UserProfile = z.infer<typeof UserProfileSchema>
```

#### Step 2: Define Separate Update Schema

```typescript
// src/schemas/profile.ts (continued)

/**
 * Update Profile Schema — only mutable fields
 */
export const UpdateProfileSchema = z.object({
  display_name: z.string().optional(),
  short_bio: z.string().optional(),
  profile_picture_path: z.string().optional(),
  banner_path: z.string().optional(),
})

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>
```

#### Step 3: Complex Schema with Nested Types

```typescript
// src/schemas/group-conversation.ts
import { z } from 'zod'

// Nested permission schema
export const MemberPermissionsSchema = z.object({
  auth_level: z.number().int().min(0),
  can_read: z.boolean(),
  can_publish: z.boolean(),
  can_revise: z.boolean(),
  can_propose: z.boolean(),
  can_overwrite: z.boolean(),
  can_comment: z.boolean(),
  can_retract_own: z.boolean(),
  can_retract_any: z.boolean(),
  can_manage_members: z.boolean(),
  can_update_properties: z.boolean(),
  can_moderate: z.boolean(),
  can_kick: z.boolean(),
  can_mute: z.boolean(),
  can_ban: z.boolean(),
})

export type MemberPermissions = z.infer<typeof MemberPermissionsSchema>

// Permission presets
export const OWNER_PRESET: MemberPermissions = {
  auth_level: 0,
  can_read: true, can_publish: true, can_revise: true,
  can_propose: true, can_overwrite: true, can_comment: true,
  can_retract_own: true, can_retract_any: true, can_manage_members: true,
  can_update_properties: true, can_moderate: true,
  can_kick: true, can_mute: true, can_ban: true,
}

export const MEMBER_PRESET: MemberPermissions = {
  auth_level: 5,
  can_read: true, can_publish: true, can_revise: false,
  can_propose: true, can_overwrite: false, can_comment: true,
  can_retract_own: true, can_retract_any: false, can_manage_members: false,
  can_update_properties: false, can_moderate: false,
  can_kick: false, can_mute: false, can_ban: false,
}

// Full entity schema
export const GroupConversationSchema = z.object({
  id: z.string(),
  type: z.literal('group'),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_user_id: z.string(),
  participant_user_ids: z.array(z.string()),
  member_permissions: z.record(z.string(), MemberPermissionsSchema),
  last_message_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type GroupConversation = z.infer<typeof GroupConversationSchema>

// Update schema (only mutable fields)
export const UpdateGroupConversationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  last_message_at: z.string().datetime().optional(),
})

export type UpdateGroupConversationInput = z.infer<typeof UpdateGroupConversationSchema>
```

#### Step 4: Use safeParse in Services

```typescript
// src/services/profile-database.service.ts
import { UserProfileSchema, type UserProfile } from '@/schemas/profile'

export class ProfileDatabaseService {
  static async getProfile(userId: string): Promise<UserProfile | null> {
    const doc = await getDocument(getUserProfile(userId), 'default')
    if (!doc) return null

    // Validate data from schemaless database
    const result = UserProfileSchema.safeParse(doc)
    if (!result.success) {
      console.error('Invalid profile data:', result.error)
      return null  // Don't crash on invalid data
    }

    return result.data
  }
}
```

#### Step 5: Validate API Request Bodies

```typescript
// src/routes/api/groups/create.tsx
import { CreateGroupSchema } from '@/schemas/group-conversation'

POST: async ({ request }) => {
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

  // Use parsed.data (fully typed and validated)
  const group = await service.create(user.uid, parsed.data)
}
```

---

## Schema Naming Conventions

| Schema | Type | Purpose |
|--------|------|---------|
| `{Entity}Schema` | `z.object(...)` | Full entity (read from DB) |
| `Create{Entity}Schema` | `z.object(...)` | Input for creation (fewer fields) |
| `Update{Entity}Schema` | `z.object(...)` | Input for update (all optional) |
| `{Entity}` | `z.infer<>` | TypeScript type for full entity |
| `Create{Entity}Input` | `z.infer<>` | TypeScript type for creation |
| `Update{Entity}Input` | `z.infer<>` | TypeScript type for update |

---

## Benefits

### 1. Runtime + Compile-Time Safety
Zod validates at runtime; `z.infer<>` provides compile-time types. Both from one definition.

### 2. Self-Documenting
Schemas serve as documentation for data models, including optional fields, constraints, and defaults.

### 3. Schemaless DB Safety
Firestore doesn't enforce schemas — Zod catches invalid or corrupted data on read.

### 4. API Input Validation
`safeParse` provides detailed validation errors (field-level) returned to clients.

---

## Trade-offs

### 1. Validation Overhead
**Downside**: Parsing every database read adds CPU time.
**Mitigation**: Only `safeParse` at boundaries. Internal data passed between services is already validated.

### 2. Schema Duplication
**Downside**: Separate create/update/read schemas can feel repetitive.
**Mitigation**: Use Zod utilities: `.pick()`, `.omit()`, `.partial()` to derive schemas from the base.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Hand-Written Types Alongside Schemas

```typescript
// ❌ BAD: Types defined separately — can drift from schema
const ProfileSchema = z.object({ display_name: z.string() })
interface Profile { displayName: string }  // Mismatch!

// ✅ GOOD: Derive types from schema
const ProfileSchema = z.object({ display_name: z.string() })
type Profile = z.infer<typeof ProfileSchema>
```

### ❌ Anti-Pattern 2: Using parse Instead of safeParse

```typescript
// ❌ BAD: parse throws on invalid data — crashes the service
const profile = ProfileSchema.parse(doc)  // Throws ZodError!

// ✅ GOOD: safeParse returns result object
const result = ProfileSchema.safeParse(doc)
if (!result.success) {
  console.error('Invalid data:', result.error)
  return null
}
return result.data
```

### ❌ Anti-Pattern 3: Schemas Outside schemas/ Directory

```typescript
// ❌ BAD: Schema defined inline in service file
// src/services/profile.service.ts
const ProfileSchema = z.object({ ... })  // Not discoverable

// ✅ GOOD: Schema in centralized directory
// src/schemas/profile.ts — discoverable, importable, documented
```

---

## Related Patterns

- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: Services use Zod schemas for validation
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: API routes validate request bodies with schemas
- **[User-Scoped Collections](./tanstack-cloudflare.user-scoped-collections.md)**: Schemas document Firestore storage paths

---

## Checklist for Implementation

- [ ] All data models defined as Zod schemas in `src/schemas/`
- [ ] TypeScript types derived with `z.infer<>`, not hand-written
- [ ] Separate schemas for create, update, and full entity
- [ ] JSDoc comments document Firestore storage path
- [ ] Services use `safeParse` (not `parse`) for database reads
- [ ] API routes use `safeParse` for request body validation
- [ ] 400 responses include `details: zodError.issues`
- [ ] Permission presets defined alongside schemas
- [ ] No `user_id` field in user-scoped document schemas

---

**Status**: Stable - Core data integrity pattern
**Recommendation**: Use for all applications with structured data models
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
