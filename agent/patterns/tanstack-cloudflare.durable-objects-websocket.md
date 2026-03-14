# Durable Objects WebSocket Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications requiring real-time communication
**Status**: Stable

---

## Overview

Cloudflare Durable Objects provide stateful, long-lived server instances that are ideal for WebSocket-based real-time features. This pattern demonstrates how to build a Durable Object that accepts WebSocket connections, processes typed messages, and delegates business logic to an injected engine using dependency injection.

The Durable Object acts as a thin coordination layer — it manages WebSocket lifecycle (accept, message routing, close) while delegating all domain logic to portable engine classes. This separation enables the business logic to be tested independently and potentially extracted into reusable packages.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building real-time features (chat, collaboration, live updates)
- Need persistent server-side state across requests
- Want WebSocket connections managed at the edge
- Need to coordinate between multiple connected clients
- Building features that require streaming responses (AI chat, file upload progress)

❌ **Don't use this pattern when:**
- Simple request/response patterns suffice (use API routes instead)
- No real-time requirement (polling or SSR preloading is simpler)
- Stateless operations (use regular Workers)

---

## Core Principles

1. **Thin Wrapper**: The Durable Object is a thin coordination layer — it manages WebSocket lifecycle and delegates business logic to injected engines
2. **Dependency Injection**: All providers (AI, storage, etc.) are injected into the engine at construction time
3. **Typed Messages**: Both client and server messages use TypeScript interfaces with discriminated `type` fields
4. **Persistent Provider Instances**: Provider instances are created once in the constructor and reused across messages for caching benefits
5. **Graceful Error Handling**: Errors are caught and sent back to the client as error messages, never crashing the Durable Object
6. **WebSocket Pair Pattern**: Use Cloudflare's `WebSocketPair` API for server-accepted WebSocket connections

---

## Implementation

### Structure

```
src/
├── durable-objects/
│   ├── ChatRoom.ts              # Durable Object (thin wrapper)
│   └── UploadManager.ts         # Another Durable Object example
├── lib/
│   ├── chat/
│   │   ├── chat-engine.ts       # Core business logic (portable)
│   │   └── interfaces/          # Provider interfaces
│   └── chat-providers/
│       ├── ai-provider.ts       # AI provider implementation
│       └── storage-provider.ts  # Storage provider implementation
└── routes/
    └── api/
        └── chat-ws.tsx          # WebSocket upgrade endpoint
```

### Code Example

#### Step 1: Define Typed Messages

```typescript
// src/durable-objects/types.ts

/** Messages sent from client → server */
interface ClientMessage {
  type: 'message' | 'load_messages' | 'init'
  userId: string
  conversationId?: string
  message?: MessageContent
  limit?: number
  startAfter?: string
}

/** Messages sent from server → client */
interface ServerMessage {
  type: 'chunk' | 'complete' | 'error' | 'message' | 'messages_loaded' | 'ready'
  content?: string
  error?: string
  message?: any
  messages?: any[]
  hasMore?: boolean
}
```

#### Step 2: Create the Durable Object

```typescript
// src/durable-objects/ChatRoom.ts
import { DurableObject } from 'cloudflare:workers'
import { ChatEngine } from '@/lib/chat'
import { BedrockAIProvider, FirebaseStorageProvider } from '@/lib/chat-providers'
import { chatLogger } from '@/lib/logger'

export class ChatRoom extends DurableObject {
  private sessions: Set<WebSocket>
  private chatEngine: ChatEngine

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.sessions = new Set()

    // Inject dependencies into engine (created once, reused across messages)
    this.chatEngine = new ChatEngine({
      aiProvider: new BedrockAIProvider(),
      storageProvider: new FirebaseStorageProvider(),
      logger: chatLogger
    })
  }

  async fetch(request: Request): Promise<Response> {
    // Verify WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    // Create WebSocket pair
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    // Accept and track connection
    server.accept()
    this.sessions.add(server)

    // Handle messages
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string) as ClientMessage

        switch (data.type) {
          case 'init':
            this.sendMessage(server, { type: 'ready' })
            break
          case 'message':
            await this.handleMessage(data, server)
            break
          case 'load_messages':
            await this.handleLoadMessages(data, server)
            break
          default:
            chatLogger.warn('Unknown message type', { type: (data as any).type })
        }
      } catch (error) {
        this.sendMessage(server, {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Handle close
    server.addEventListener('close', () => {
      this.sessions.delete(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleMessage(data: ClientMessage, socket: WebSocket): Promise<void> {
    const { userId, conversationId = 'main', message } = data

    if (!message) {
      this.sendMessage(socket, { type: 'error', error: 'No message provided' })
      return
    }

    // Delegate to engine with streaming callback
    await this.chatEngine.processMessage({
      userId,
      conversationId,
      message,
      onMessage: (msg) => {
        this.sendMessage(socket, msg)
      }
    })
  }

  private async handleLoadMessages(data: ClientMessage, socket: WebSocket): Promise<void> {
    const { userId, conversationId = 'main', limit = 50, startAfter } = data

    try {
      const messages = await this.chatEngine.loadMessages({
        userId, conversationId, limit, startAfter
      })

      this.sendMessage(socket, {
        type: 'messages_loaded',
        messages,
        hasMore: messages.length === limit
      })
    } catch (error) {
      this.sendMessage(socket, {
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to load messages'
      })
    }
  }

  private sendMessage(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message))
    } catch (error) {
      console.error('Failed to send WebSocket message', error)
    }
  }
}
```

#### Step 3: Configure Wrangler

```toml
# wrangler.toml

# Durable Object bindings
[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

# Migrations
[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]
```

#### Step 4: Create WebSocket Upgrade Route

```typescript
// src/routes/api/chat-ws.tsx
import { createFileRoute } from '@tanstack/react-router'
import { getAuthSession } from '@/lib/auth/server-fn'

export const Route = createFileRoute('/api/chat-ws')({
  server: {
    handlers: {
      GET: async ({ request, context }) => {
        const user = await getAuthSession()
        if (!user) {
          return new Response('Unauthorized', { status: 401 })
        }

        // Get Durable Object stub
        const env = context.cloudflare.env as Env
        const id = env.CHAT_ROOM.idFromName(user.uid)
        const stub = env.CHAT_ROOM.get(id)

        // Forward WebSocket upgrade to Durable Object
        return stub.fetch(request)
      },
    },
  },
})
```

#### Step 5: Client-Side WebSocket Hook

```typescript
// src/hooks/use-websocket.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseWebSocketOptions {
  userId: string
  onMessage: (message: ServerMessage) => void
  onConnectionChange?: (connected: boolean) => void
}

export function useWebSocket({ userId, onMessage, onConnectionChange }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat-ws`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      onConnectionChange?.(true)
      ws.send(JSON.stringify({ type: 'init', userId }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      onMessage(data)
    }

    ws.onclose = () => {
      setConnected(false)
      onConnectionChange?.(false)
    }

    return () => ws.close()
  }, [userId])

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  return { connected, sendMessage }
}
```

---

## Examples

### Example 1: File Upload Durable Object

```typescript
// src/durable-objects/UploadManager.ts
import { DurableObject } from 'cloudflare:workers'

export class UploadManager extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.accept()

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string)

        switch (data.type) {
          case 'upload_chunk':
            // Process chunk, report progress
            server.send(JSON.stringify({
              type: 'progress',
              progress: data.chunkIndex / data.totalChunks * 100
            }))
            break
          case 'upload_complete':
            // Finalize upload
            server.send(JSON.stringify({ type: 'complete', url: signedUrl }))
            break
        }
      } catch (error) {
        server.send(JSON.stringify({ type: 'error', error: String(error) }))
      }
    })

    return new Response(null, { status: 101, webSocket: client })
  }
}
```

### Example 2: Internal HTTP Endpoint on Durable Object

```typescript
// Durable Objects can also handle non-WebSocket HTTP requests
export class ChatRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Internal cache invalidation endpoint
    if (url.pathname === '/invalidate-cache' && request.method === 'POST') {
      const body = await request.json()
      this.mcpProvider.clearCache()
      return Response.json({ success: true })
    }

    // WebSocket upgrade (normal flow)
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    return new Response('Expected WebSocket or known endpoint', { status: 426 })
  }
}
```

---

## Benefits

### 1. Persistent State Across Messages
Durable Objects maintain state between requests, enabling caching of provider instances and connection state.

### 2. Edge-Based Real-Time
WebSocket connections run at Cloudflare's edge, providing low-latency real-time communication globally.

### 3. Testable Business Logic
Business logic lives in injected engines, not in the Durable Object itself, making it independently testable.

### 4. Automatic Scaling
Each Durable Object instance is uniquely addressable (by user ID, room ID, etc.) and scales automatically.

---

## Trade-offs

### 1. Durable Object Limitations
**Downside**: Each Durable Object runs in a single location and has CPU/memory limits.
**Mitigation**: Keep Durable Objects thin. Delegate heavy work to external services.

### 2. Cold Start Latency
**Downside**: First request to a Durable Object may have cold start delay.
**Mitigation**: Use `init` messages to pre-warm connections after WebSocket establishes.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Business Logic in Durable Object

```typescript
// ❌ BAD: Business logic mixed into Durable Object
export class ChatRoom extends DurableObject {
  async handleMessage(data, socket) {
    const response = await fetch('https://api.anthropic.com/...')  // Direct API call
    const messages = await getDocument(...)  // Direct DB call
    // ... 200 lines of business logic
  }
}

// ✅ GOOD: Delegate to engine
export class ChatRoom extends DurableObject {
  async handleMessage(data, socket) {
    await this.chatEngine.processMessage({
      ...data,
      onMessage: (msg) => this.sendMessage(socket, msg)
    })
  }
}
```

### ❌ Anti-Pattern 2: Creating Providers Per Message

```typescript
// ❌ BAD: New provider instances per message (loses caching)
server.addEventListener('message', async (event) => {
  const aiProvider = new BedrockAIProvider()  // Created every message!
  const engine = new ChatEngine({ aiProvider })
})

// ✅ GOOD: Create once in constructor
constructor(state, env) {
  this.chatEngine = new ChatEngine({
    aiProvider: new BedrockAIProvider()  // Created once, reused
  })
}
```

---

## Testing Strategy

### Unit Testing Engine (Without Durable Object)

```typescript
describe('ChatEngine', () => {
  it('should process messages', async () => {
    const mockAI = { streamChat: jest.fn() }
    const mockStorage = { saveMessage: jest.fn(), loadMessages: jest.fn() }

    const engine = new ChatEngine({
      aiProvider: mockAI,
      storageProvider: mockStorage
    })

    const messages: any[] = []
    await engine.processMessage({
      userId: 'user1',
      conversationId: 'conv1',
      message: 'Hello',
      onMessage: (msg) => messages.push(msg)
    })

    expect(mockStorage.saveMessage).toHaveBeenCalled()
  })
})
```

---

## Related Patterns

- **[Provider Adapter Pattern](./tanstack-cloudflare.provider-adapter.md)**: Interfaces for dependency injection into engines
- **[Rate Limiting Pattern](./tanstack-cloudflare.rate-limiting.md)**: Rate limit WebSocket connections
- **[Wrangler Configuration](./tanstack-cloudflare.wrangler-configuration.md)**: Durable Object bindings and migrations

---

## Checklist for Implementation

- [ ] Durable Object extends `DurableObject` from `cloudflare:workers`
- [ ] Business logic delegated to injected engine
- [ ] Provider instances created once in constructor
- [ ] Typed `ClientMessage` and `ServerMessage` interfaces
- [ ] `switch` statement on `data.type` for message routing
- [ ] Error handling wraps every message handler
- [ ] Errors sent to client as `{ type: 'error', error: string }`
- [ ] WebSocket pair created with `new WebSocketPair()`
- [ ] Server socket accepted with `server.accept()`
- [ ] Sessions tracked in `Set<WebSocket>` and cleaned up on close
- [ ] Wrangler configured with DO bindings and migrations
- [ ] WebSocket upgrade route validates auth before forwarding

---

**Status**: Stable - Proven pattern for real-time features on Cloudflare Workers
**Recommendation**: Use for all real-time features requiring persistent server-side state
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
