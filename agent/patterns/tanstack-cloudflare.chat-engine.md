# Chat Engine

**Category**: Architecture
**Applicable To**: Adding AI chat bots to TanStack + Cloudflare applications with tool calling, streaming, MCP integration, and message persistence
**Status**: Stable

---

## Overview

ChatEngine is a provider-agnostic chat orchestration layer that coordinates AI models, message storage, MCP tool servers, and vision processing through dependency-injected interfaces. It handles the complete message lifecycle: token budgeting, system prompt building with prompt injectors, MCP tool discovery and caching, multi-turn tool execution with persistence, streaming responses, message ACL, and conversation management. Designed to be extracted into a standalone package — clients of the `tanstack-cloudflare` ACP package can use this as a clear path to adding chat bots to their application.

---

## When to Use This Pattern

**Use this pattern when:**
- Adding an AI chat bot to a TanStack + Cloudflare application
- Building a multi-tool AI assistant with MCP server integration
- Implementing streaming chat with tool call persistence
- Creating a white-label chat experience with pluggable AI providers

**Don't use this pattern when:**
- Building a simple form-based AI query (use direct API call)
- The application doesn't need real-time streaming or tool calling

---

## Core Principles

1. **Dependency Injection**: All external services (AI, storage, MCP, vision) are injected as interfaces — swap providers without changing orchestration logic
2. **MCP Caching**: Server connections and tool definitions cached per-user with 24h TTL — avoids expensive RPC on every message
3. **Tool Persistence**: Tool calls saved as intermediate messages (`is_tool_interaction: true`) so the AI sees prior tool output on continuation
4. **Token Budgeting**: Heuristic estimation + optional preflight check via `countTokens` API prevents "prompt too long" errors
5. **Fire-and-Forget Non-Critical Ops**: Analytics, usage tracking, and title generation don't block the response stream

---

## Implementation

### Provider Interfaces

```typescript
interface ChatEngineDependencies {
  aiProvider: IAIProvider
  storageProvider: IStorageProvider
  mcpProvider: IMCPProvider
  visionProvider: IVisionProvider
  logger: ILogger
  env?: Record<string, unknown>
}

interface IAIProvider {
  streamChat(params: {
    messages: ChatMessage[]
    systemPrompt: string
    tools: Tool[]
    onMessage: (msg: ChatEngineMessage) => void
    executeTool: (name: string, input: any, id?: string) => Promise<any>
    signal?: AbortSignal
  }): Promise<void>
}

interface IStorageProvider {
  saveMessage(params): Promise<Message>
  loadMessages(params): Promise<Message[]>
  ensureConversation(params): Promise<string>
  updateConversation(params): Promise<void>
  addToolCall(params): Promise<string>        // Persist tool invocation
  updateToolCall(params): Promise<void>       // Update with result
  getToolCallsForMessages(params): Promise<Map<string, PersistedToolCall[]>>
}

interface IMCPProvider {
  getAvailableServers(params): Promise<MCPServer[]>
  connectToServers(params): Promise<MCPConnection[]>
  getTools(connections): Promise<Tool[]>       // Cached after first call
  executeTool(params): Promise<any>
  disconnect(connections): Promise<void>
}

interface IVisionProvider {
  processImagesInMessage(params): Promise<MessageContent>
}
```

### Instantiation in ChatRoom DO

```typescript
class ChatRoom extends DurableObject {
  private chatEngine: ChatEngine
  private mcpProvider: MCPProvider  // Persisted for caching

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.mcpProvider = new MCPProvider()
    this.chatEngine = new ChatEngine({
      aiProvider: new AnthropicAIProvider(),
      storageProvider: new FirebaseStorageProvider(),
      mcpProvider: this.mcpProvider,  // Reused across messages for caching
      visionProvider: new GoogleVisionProvider(),
      logger: chatLogger,
      env: env as unknown as Record<string, unknown>,
    })
  }
}
```

### Message Processing Pipeline

```
processMessage(userId, conversationId, message, onMessage, signal)

 1. Token limit check → reject if subscription exceeded
 2. Ensure conversation exists
 3. Detect @agent mention → determine if agent should respond
 4. Resolve @username mentions → @uid:userId
 5. Assign message ACL (visible_to_user_ids)
 6. Save user message → emit user_message_saved
 7. Process images via vision provider
 8. Load message history (ACL-filtered)
 9. Get MCP servers + connect (cached 24h)
10. Fetch tools (cached) + build system prompt (parallel)
11. Apply tool filters from prompt injectors
12. Format messages with timestamps + locations
13. Token-based truncation (60K budget, oldest first)
14. Preflight check if estimate > 180K (countTokens API)
15. Stream AI response with tool execution
16. Save assistant message + tool call records
17. Generate conversation title (fire-and-forget, 2nd message)
18. Update conversation metadata
```

### Tool Execution Flow

```typescript
executeTool: async (toolName, toolInput, toolCallId) => {
  // 1. Create persistent record (status: 'pending')
  const id = await storageProvider.addToolCall({ toolName, status: 'pending', inputs: toolInput })

  // 2. Execute (local tool registry or MCP provider)
  const result = isLocalTool(toolName)
    ? await executeLocalTool(toolName, userId, toolInput, env)
    : await mcpProvider.executeTool({ toolName, toolInput, connections })

  // 3. Update record (status: 'success', output: result)
  storageProvider.updateToolCall({ id, status: 'success', output: result })

  // 4. Track analytics (fire-and-forget)
  AnalyticsService.trackServerEvent(userId, 'tool_executed', { tool: toolName })

  return result  // Returned to AI for next turn
}
```

### MCP Caching Strategy

```typescript
class MCPProvider implements IMCPProvider {
  private serverCache: MCPServer[] = []
  private connectionCache: MCPConnection[] = []
  private toolDefsCache: Tool[] = []
  private toolMapCache: Map<string, MCPConnection> = new Map()
  private cacheExpiry: number = 0
  private cacheUserId: string = ''
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000  // 24 hours

  // Cache invalidated when: user changes, TTL expires, or OAuth connect/disconnect
}
```

### Token Budgeting

```typescript
// Heuristic estimation
const MESSAGE_TOKEN_BUDGET = 60_000   // ~120K after formatting
const PREFLIGHT_THRESHOLD = 180_000   // 90% of 200K API limit
const SAFE_TARGET = 170_000           // Leave room for output

// Estimation ratios
Text:       ~4 chars/token
JSON:       ~2.5 chars/token
Base64 img: ~1 token/300 bytes
Per-message: 50 token overhead

// TokenRatioService learns from actual token counts
// Adjusts future estimates based on preflight feedback
```

### System Prompt Building

System prompt assembled from:
1. Anti-hallucination preamble (tool call requirements)
2. Markdown formatting rules
3. Web tool instructions
4. **Prompt injectors** (modular, priority-ordered extensions):
   - Ghost persona injector (priority 0.9, mutex: ghost)
   - Agent memory injector (priority 0.7, mutex: memory-context)
   - Space/group context injector
   - Each returns: `{ content: string, toolFilters?: { allow?, deny? }[] }`
5. Conversation type context (chat/DM/group behavior)

### Message ACL

```typescript
// Group/DM: @agent responses visible only to sender
MessageAclService.assignACL('group', hasAgentMention, userId)
// → { visible_to_user_ids: [userId], created_for_user_id: userId }

// History filtering: only load messages the user can see
MessageAclService.filterMessagesByACL(allMessages, userId)
```

### ChatEngineMessage Types (Streaming Events)

```typescript
type ChatEngineMessage =
  | { type: 'chunk'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall; persistedToolCallId?: string }
  | { type: 'tool_result'; toolResult: ToolResult }
  | { type: 'user_message_saved'; message: Message }
  | { type: 'assistant_message_saved'; message: Message }
  | { type: 'complete' }
  | { type: 'cancelled' }
  | { type: 'error'; error: string }
  | { type: 'usage'; input_tokens: number; output_tokens: number }
  | { type: 'token_limit_warning'; percentage: number }
  | { type: 'progress_start' | 'progress_update' | 'progress_complete' | 'progress_error' }
  | { type: 'status'; status: string }
  | { type: 'debug'; message: string }
```

---

## Adding Chat to a New Application

### Step 1: Implement Provider Interfaces

```typescript
// Minimal: just AI + storage
const engine = new ChatEngine({
  aiProvider: new AnthropicAIProvider(),           // Or OpenAI, etc.
  storageProvider: new MyDatabaseStorageProvider(), // Firestore, Postgres, etc.
  mcpProvider: new NoOpMCPProvider(),               // No tools initially
  visionProvider: new NoOpVisionProvider(),          // No images initially
  logger: console,
})
```

### Step 2: Create a Durable Object Host

```typescript
class MyChatRoom extends DurableObject {
  private engine: ChatEngine

  constructor(state, env) {
    super(state, env)
    this.engine = new ChatEngine({ /* providers */ })
  }

  async fetch(request: Request) {
    // WebSocket upgrade → session management → message routing
  }
}
```

### Step 3: Connect Client via WebSocket

```typescript
const ws = new ChatWebSocket({
  userId: user.uid,
  conversationId: 'main',
  onMessage: (msg) => {
    switch (msg.type) {
      case 'chunk': /* append streaming text */ break
      case 'tool_call': /* show tool badge */ break
      case 'complete': /* finalize message */ break
    }
  },
})
ws.connect()
```

### Step 4: Add Tools (Optional)

Register local tools or connect MCP servers:
```typescript
// Local tools
registerLocalTool('my_search', { description: '...', input_schema: {...} }, handler)

// MCP servers
mcpProvider = new MCPProvider()  // Auto-discovers user's connected servers
```

---

## Anti-Patterns

### Creating New MCPProvider Per Message

```typescript
// Bad: Loses tool/connection cache on every message
async handleMessage(data) {
  const mcp = new MCPProvider()  // New instance = no cache
  await this.engine.processMessage({ ... })
}

// Good: Reuse instance across messages (persist in DO)
constructor() {
  this.mcpProvider = new MCPProvider()  // Cached connections/tools
  this.engine = new ChatEngine({ mcpProvider: this.mcpProvider })
}
```

### Blocking on Non-Critical Operations

```typescript
// Bad: Analytics blocks the response stream
await AnalyticsService.trackServerEvent(userId, 'tool_executed', {...})
onMessage({ type: 'complete' })

// Good: Fire-and-forget
AnalyticsService.trackServerEvent(userId, 'tool_executed', {...}).catch(() => {})
onMessage({ type: 'complete' })
```

---

## Checklist

- [ ] All providers injected via constructor (no hard dependencies)
- [ ] MCPProvider instance persisted across messages for caching
- [ ] Tool calls persisted with `addToolCall`/`updateToolCall`
- [ ] Message history truncated before AI call (60K token budget)
- [ ] Preflight check runs if estimate > 180K tokens
- [ ] System prompt built with prompt injectors (priority-ordered)
- [ ] Message ACL applied on save and load
- [ ] Non-critical operations (analytics, titles) are fire-and-forget
- [ ] AbortSignal passed through for cancellation support

---

## Related Patterns

- **[WebSocket Manager](./tanstack-cloudflare.websocket-manager.md)**: Client-side WebSocket that connects to ChatRoom DO
- **[Firebase Firestore](./tanstack-cloudflare.firebase-firestore.md)**: IStorageProvider implementation
- **[Firebase Auth](./tanstack-cloudflare.firebase-auth.md)**: User auth for message ownership

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
