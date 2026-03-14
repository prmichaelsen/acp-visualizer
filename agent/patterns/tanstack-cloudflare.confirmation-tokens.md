# Confirmation Tokens Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with AI-initiated mutations
**Status**: Stable

---

## Overview

The Confirmation Token pattern provides a two-step execution flow for dangerous or irreversible operations, especially when initiated by AI tools. Instead of executing a mutation immediately, the system generates a preview of the action along with a single-use confirmation token. The user (or AI confirmation tool) must explicitly confirm the action by presenting the token, which is then consumed to execute the operation.

This pattern prevents accidental mutations, provides a human-in-the-loop checkpoint for AI operations, and ensures that the exact operation previewed is the one that executes (no TOCTOU race conditions).

---

## When to Use This Pattern

✅ **Use this pattern when:**
- AI agents can trigger mutations (create, update, delete operations)
- Operations are irreversible or have significant side effects
- Want a human-in-the-loop confirmation step
- Need to prevent accidental execution of dangerous operations
- Building tools that the AI calls which modify user data

❌ **Don't use this pattern when:**
- Operations are read-only (no mutations)
- The user is directly clicking a button (standard UI confirmation is sufficient)
- Operations are trivially reversible
- Low-risk operations where speed matters more than safety

---

## Core Principles

1. **Two-Step Execution**: Preview + confirm, never direct execution
2. **Single-Use Tokens**: Each token can only be consumed once — prevents replay
3. **User-Scoped**: Tokens validate that the confirming user matches the initiating user
4. **TTL Expiration**: Tokens expire after a configurable time (default: 5 minutes)
5. **Tamper-Proof**: Token encodes the exact operation parameters — confirming executes exactly what was previewed
6. **In-Memory Store**: Tokens stored in memory within the Durable Object session (no database overhead)

---

## Implementation

### Step 1: Define the Token Service

```typescript
// src/services/confirmation-token.service.ts
import { randomBytes } from 'node:crypto'

/**
 * A pending action stored against a confirmation token.
 * Encodes the exact operation parameters to prevent tampering.
 */
export interface PendingAction {
  type: 'create_group' | 'update_group' | 'generate_group_link' | 'delete_resource'
  userId: string
  params: Record<string, unknown>
  summary: string
  createdAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000  // 5 minutes

/**
 * Module-level singleton — persists across calls within the same Durable Object session.
 */
let _instance: ConfirmationTokenService | null = null
export function getConfirmationTokenService(): ConfirmationTokenService {
  if (!_instance) _instance = new ConfirmationTokenService()
  return _instance
}

export class ConfirmationTokenService {
  private pending = new Map<string, PendingAction>()
  private ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /**
   * Generate a confirmation token for a pending action.
   * Returns a 32-char hex string.
   */
  generateToken(action: PendingAction): string {
    this.cleanup()
    const token = randomBytes(16).toString('hex')
    this.pending.set(token, action)
    return token
  }

  /**
   * Consume a confirmation token.
   * Returns the pending action if valid, null otherwise.
   * Tokens are single-use — consumed on retrieval.
   * Validates userId matches the original initiator.
   */
  consumeToken(token: string, userId: string): PendingAction | null {
    const action = this.pending.get(token)
    if (!action) return null

    // Always delete — single use
    this.pending.delete(token)

    // Check TTL
    if (Date.now() - action.createdAt > this.ttlMs) return null

    // Validate userId matches
    if (action.userId !== userId) return null

    return action
  }

  /**
   * Lazy cleanup of expired tokens.
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [token, action] of this.pending) {
      if (now - action.createdAt > this.ttlMs) {
        this.pending.delete(token)
      }
    }
  }
}
```

### Step 2: Create a Mutating Tool (Preview + Token)

```typescript
// src/lib/chat/tools/create-group.ts
import { getConfirmationTokenService } from '@/services/confirmation-token.service'

export const createGroupTool = {
  name: 'create_group',
  description: 'Create a new group conversation. Returns a preview and confirmation token.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'Group name' },
      description: { type: 'string', description: 'Group description' },
    },
    required: ['name'],
  },

  async execute(input: { name: string; description?: string }, userId: string) {
    const tokenService = getConfirmationTokenService()

    // Generate preview + token (don't execute yet)
    const token = tokenService.generateToken({
      type: 'create_group',
      userId,
      params: { name: input.name, description: input.description },
      summary: `Create group "${input.name}"`,
      createdAt: Date.now(),
    })

    return {
      preview: {
        action: 'create_group',
        name: input.name,
        description: input.description || '(none)',
      },
      confirmation_token: token,
      message: `I'll create a group called "${input.name}". Please confirm to proceed.`,
    }
  },
}
```

### Step 3: Create a Confirm Tool (Execute with Token)

```typescript
// src/lib/chat/tools/confirm.ts
import { getConfirmationTokenService } from '@/services/confirmation-token.service'
import { GroupConversationDatabaseService } from '@/services/group-conversation-database.service'

export const confirmTool = {
  name: 'confirm_action',
  description: 'Confirm and execute a previously previewed action using its confirmation token.',
  input_schema: {
    type: 'object' as const,
    properties: {
      confirmation_token: { type: 'string', description: 'The token from the preview step' },
    },
    required: ['confirmation_token'],
  },

  async execute(input: { confirmation_token: string }, userId: string) {
    const tokenService = getConfirmationTokenService()
    const action = tokenService.consumeToken(input.confirmation_token, userId)

    if (!action) {
      return {
        success: false,
        error: 'Invalid, expired, or already-used confirmation token.',
      }
    }

    // Execute the confirmed action
    switch (action.type) {
      case 'create_group': {
        const { name, description } = action.params as { name: string; description?: string }
        const group = await GroupConversationDatabaseService.createGroupConversation(
          userId,
          { name, description }
        )
        return { success: true, group, message: `Group "${name}" created successfully.` }
      }

      case 'delete_resource': {
        // ... handle deletion
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` }
    }
  },
}
```

---

## Flow Diagram

```
User: "Create a group called Book Club"
  ↓
AI calls create_group tool
  ↓
Tool returns: { preview: {...}, confirmation_token: "abc123", message: "Please confirm" }
  ↓
AI shows preview to user: "I'll create a group called Book Club. Please confirm."
  ↓
User: "Yes, go ahead"
  ↓
AI calls confirm_action tool with token "abc123"
  ↓
Token consumed → action executed → group created
  ↓
AI: "Done! Group 'Book Club' has been created."
```

---

## Security Properties

| Property | How It's Enforced |
|----------|-------------------|
| **Single-use** | Token deleted on consumption |
| **Time-limited** | TTL check (default 5 min) |
| **User-scoped** | userId verified on consumption |
| **Tamper-proof** | Action params encoded in token, not in confirm request |
| **No replay** | Consumed tokens return null |

---

## Benefits

### 1. Human-in-the-Loop
AI shows a preview before executing, giving users a chance to cancel.

### 2. Prevents Accidental Mutations
No direct execution path — always preview first.

### 3. TOCTOU Safety
The exact operation previewed is what executes (params stored in token, not re-sent).

### 4. Zero Database Overhead
In-memory token store within the Durable Object session — no database writes.

---

## Trade-offs

### 1. In-Memory Volatility
**Downside**: If the Durable Object restarts, all pending tokens are lost.
**Mitigation**: 5-minute TTL means most tokens are consumed quickly. Users can retry.

### 2. Extra Round Trip
**Downside**: Two tool calls instead of one for every mutation.
**Mitigation**: Only use for high-impact operations. Read-only tools execute directly.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Executing Without Token

```typescript
// ❌ BAD: Tool directly executes mutation
async execute(input, userId) {
  const group = await service.createGroup(userId, input)  // No confirmation!
  return { group }
}

// ✅ GOOD: Tool returns preview + token
async execute(input, userId) {
  const token = tokenService.generateToken({ type: 'create_group', userId, params: input })
  return { preview: input, confirmation_token: token }
}
```

### ❌ Anti-Pattern 2: Re-Sending Params in Confirm

```typescript
// ❌ BAD: Confirm re-sends params (can be tampered)
confirm_action({ token: 'abc', name: 'Evil Group' })  // Name changed!

// ✅ GOOD: Params come from the stored token
const action = tokenService.consumeToken(token, userId)
const { name } = action.params  // Params from original preview
```

---

## Related Patterns

- **[ACL Permissions](./tanstack-cloudflare.acl-permissions.md)**: Permission checks happen before token generation
- **[Durable Objects WebSocket](./tanstack-cloudflare.durable-objects-websocket.md)**: Token service lives within DO session
- **[API Route Handlers](./tanstack-cloudflare.api-route-handlers.md)**: Can also be used in HTTP API flows

---

## Checklist for Implementation

- [ ] `ConfirmationTokenService` with `generateToken` and `consumeToken`
- [ ] Tokens are cryptographically random (32-char hex)
- [ ] Single-use: deleted on consumption
- [ ] TTL enforced (default 5 minutes)
- [ ] User ID validated on consumption
- [ ] Action params stored in token, not re-sent on confirm
- [ ] Mutating tools return preview + token
- [ ] Confirm tool consumes token and executes stored action
- [ ] Expired/invalid tokens return clear error messages
- [ ] Lazy cleanup of expired tokens on new generation

---

**Status**: Stable - Proven pattern for AI-initiated mutations
**Recommendation**: Use for all mutating operations triggered by AI tools
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
