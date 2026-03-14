# ACL Permissions Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with multi-user authorization
**Status**: Stable

---

## Overview

The ACL (Access Control List) Permissions pattern provides fine-grained, flag-based authorization for multi-user features like groups, channels, and shared spaces. Instead of using coarse role-based access (owner/admin/member), each user gets a set of boolean permission flags that control exactly what actions they can perform.

Permission presets (OWNER, ADMIN, EDITOR, MEMBER) provide sensible defaults while allowing per-user customization. An `auth_level` numeric hierarchy enables authority-based checks (lower number = more authority), preventing members from elevating their own privileges or acting on users with higher authority.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building multi-user features (groups, channels, shared spaces)
- Need granular control over who can do what
- Want to support custom permission configurations beyond simple roles
- Need authority hierarchy (owners can't be kicked by members)
- Building moderation features (kick, mute, ban)

❌ **Don't use this pattern when:**
- Application has only single-user data (no shared resources)
- Simple owner/non-owner distinction is sufficient
- Using an external authorization service (Auth0 FGA, etc.)

---

## Core Principles

1. **Flag-Based Permissions**: Boolean flags for each capability, not string roles
2. **Authority Hierarchy**: Numeric `auth_level` (0 = owner, higher = less authority)
3. **Presets for Convenience**: OWNER, ADMIN, EDITOR, MEMBER presets with sensible defaults
4. **Stored on Entity**: Permissions stored directly on the group/channel document as `member_permissions[userId]`
5. **Thin ACL Service**: Validation logic in a dedicated service, not scattered across handlers
6. **Check Before Act**: Always validate permissions before performing any action

---

## Implementation

### Step 1: Define Permission Schema

```typescript
// src/schemas/group-conversation.ts
import { z } from 'zod'

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
```

### Step 2: Define Permission Presets

```typescript
// src/schemas/group-conversation.ts (continued)

export const OWNER_PRESET: MemberPermissions = {
  auth_level: 0,
  can_read: true, can_publish: true, can_revise: true,
  can_propose: true, can_overwrite: true, can_comment: true,
  can_retract_own: true, can_retract_any: true, can_manage_members: true,
  can_update_properties: true, can_moderate: true,
  can_kick: true, can_mute: true, can_ban: true,
}

export const ADMIN_PRESET: MemberPermissions = {
  auth_level: 1,
  can_read: true, can_publish: true, can_revise: true,
  can_propose: true, can_overwrite: true, can_comment: true,
  can_retract_own: true, can_retract_any: true, can_manage_members: true,
  can_update_properties: true, can_moderate: true,
  can_kick: true, can_mute: true, can_ban: true,
}

export const EDITOR_PRESET: MemberPermissions = {
  auth_level: 3,
  can_read: true, can_publish: true, can_revise: true,
  can_propose: true, can_overwrite: false, can_comment: true,
  can_retract_own: true, can_retract_any: false, can_manage_members: false,
  can_update_properties: false, can_moderate: false,
  can_kick: false, can_mute: false, can_ban: false,
}

export const MEMBER_PRESET: MemberPermissions = {
  auth_level: 5,
  can_read: true, can_publish: true, can_revise: false,
  can_propose: true, can_overwrite: false, can_comment: true,
  can_retract_own: true, can_retract_any: false, can_manage_members: false,
  can_update_properties: false, can_moderate: false,
  can_kick: false, can_mute: false, can_ban: false,
}
```

### Step 3: Store Permissions on Entity

```typescript
// src/schemas/group-conversation.ts (continued)

export const GroupConversationSchema = z.object({
  id: z.string(),
  type: z.literal('group'),
  name: z.string(),
  description: z.string().nullable().optional(),
  owner_user_id: z.string(),
  participant_user_ids: z.array(z.string()),
  // Permissions stored per-user on the document itself
  member_permissions: z.record(z.string(), MemberPermissionsSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

export type GroupConversation = z.infer<typeof GroupConversationSchema>
```

### Step 4: Create ACL Service

```typescript
// src/services/group-acl.service.ts
import { GroupConversationDatabaseService } from './group-conversation-database.service'
import type { MemberPermissions } from '@/schemas/group-conversation'

/**
 * Group ACL Service
 *
 * Thin access-control layer over GroupConversationDatabaseService.
 * Provides permission-based access validation and membership queries.
 */
export class GroupAclService {
  /**
   * Validate a user has access to a group.
   * Returns their permissions if granted, null otherwise.
   */
  static async validateGroupAccess(
    userId: string,
    groupId: string
  ): Promise<MemberPermissions | null> {
    const group = await GroupConversationDatabaseService.getGroupConversation(userId, groupId)
    if (!group) return null
    return group.member_permissions[userId] ?? null
  }

  /**
   * Get all group IDs the user belongs to.
   */
  static async getGroupMemberships(userId: string): Promise<string[]> {
    const groups = await GroupConversationDatabaseService.listGroupConversations(userId)
    return groups.map(g => g.id)
  }
}
```

### Step 5: Use in API Routes

```typescript
// src/routes/api/groups/$id/index.tsx
PATCH: async ({ params, request }) => {
  const { id } = params
  const user = await getAuthSession()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check permission
  const permissions = await GroupAclService.validateGroupAccess(user.uid, id)
  if (!permissions) return Response.json({ error: 'Not found' }, { status: 404 })

  if (!permissions.can_update_properties) {
    return Response.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 })
  }

  // Proceed with update...
  const body = await request.json()
  await GroupConversationDatabaseService.updateGroupConversation(user.uid, id, body)
  return Response.json({ success: true })
}
```

### Step 6: Authority-Based Checks

```typescript
// src/routes/api/groups/$id/members/$userId.tsx
DELETE: async ({ params, request }) => {
  const { id, userId: targetUserId } = params
  const user = await getAuthSession()

  const myPermissions = await GroupAclService.validateGroupAccess(user.uid, id)
  if (!myPermissions?.can_kick) {
    return Response.json({ error: 'Forbidden: cannot kick members' }, { status: 403 })
  }

  // Authority check: can't kick someone with equal or higher authority
  const targetPermissions = await GroupAclService.validateGroupAccess(targetUserId, id)
  if (targetPermissions && targetPermissions.auth_level <= myPermissions.auth_level) {
    return Response.json({
      error: 'Forbidden: cannot kick a user with equal or higher authority'
    }, { status: 403 })
  }

  await GroupConversationDatabaseService.removeMember(user.uid, id, targetUserId)
  return Response.json({ success: true })
}
```

---

## Permission Presets Summary

| Preset | auth_level | Key Capabilities |
|--------|-----------|------------------|
| OWNER | 0 | Everything — full control |
| ADMIN | 1 | Everything except cannot override owner |
| EDITOR | 3 | Read, publish, revise, comment, retract own |
| MEMBER | 5 | Read, publish, propose, comment, retract own |

---

## Moderation Actions

```typescript
// src/schemas/group-conversation.ts
export const ModerationActionSchema = z.object({
  action: z.enum(['kick', 'mute', 'ban', 'message_delete', 'memory_moderate']),
  target_user_id: z.string(),
  acted_by_user_id: z.string(),
  acted_by_auth_level: z.number().int().min(0),
  created_at: z.string().datetime(),
  reversed_at: z.string().datetime().optional(),
  reversed_by_user_id: z.string().optional(),
})

// Authority rule: can only reverse actions by users at your level or below
// (higher auth_level number = less authority)
```

---

## Benefits

### 1. Granular Control
15 individual flags enable precise permission configurations beyond simple roles.

### 2. Authority Hierarchy
Numeric `auth_level` prevents privilege escalation (members can't kick admins).

### 3. Stored on Entity
No separate permissions table — permissions live on the group document itself.

### 4. Preset Templates
OWNER/ADMIN/EDITOR/MEMBER presets provide quick setup while allowing customization.

---

## Trade-offs

### 1. Schema Size
**Downside**: 15 boolean flags per member adds document size.
**Mitigation**: Minimal overhead per member (~200 bytes). Only relevant for very large groups.

### 2. No Inheritance
**Downside**: Each group manages its own permissions — no global roles.
**Mitigation**: Use presets for consistency. Global admin features can check a separate admin flag.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: String-Based Roles

```typescript
// ❌ BAD: Coarse roles — no way to customize
member_roles: { 'user1': 'admin', 'user2': 'member' }

// ✅ GOOD: Fine-grained flags
member_permissions: { 'user1': ADMIN_PRESET, 'user2': { ...MEMBER_PRESET, can_revise: true } }
```

### ❌ Anti-Pattern 2: Checking Permissions in Components

```typescript
// ❌ BAD: Permission check on client (can be bypassed)
if (userRole === 'admin') showDeleteButton()

// ✅ GOOD: Server-side validation in API route
if (!permissions.can_retract_any) return Response.json({ error: 'Forbidden' }, { status: 403 })
```

---

## Related Patterns

- **[Zod Schema Validation](./tanstack-cloudflare.zod-schema-validation.md)**: Permission schemas defined with Zod
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: ACL checks in API routes
- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: ACL service as thin wrapper over database service

---

## Checklist for Implementation

- [ ] Permission schema defined with Zod
- [ ] Presets for OWNER, ADMIN, EDITOR, MEMBER
- [ ] `auth_level` hierarchy enforced (lower = more authority)
- [ ] Permissions stored on entity document as `member_permissions[userId]`
- [ ] ACL service validates access before any operation
- [ ] Authority checks prevent privilege escalation
- [ ] API routes return 403 for insufficient permissions
- [ ] Moderation actions stamped with `acted_by_auth_level`

---

**Status**: Stable - Proven permission model for multi-user features
**Recommendation**: Use for all shared resources requiring granular authorization
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
