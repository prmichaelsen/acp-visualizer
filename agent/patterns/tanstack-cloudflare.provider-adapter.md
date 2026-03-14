# Provider Adapter Pattern

**Category**: Architecture
**Applicable To**: TanStack Start + Cloudflare Workers applications with pluggable backends
**Status**: Stable

---

## Overview

The Provider Adapter pattern defines TypeScript interfaces for external dependencies (AI providers, storage backends, messaging protocols, vision APIs) and injects concrete implementations at construction time. This enables the core business logic to remain portable, testable, and provider-agnostic while allowing implementations to be swapped without code changes.

By defining contracts as interfaces and injecting implementations, you can:
- Swap AI providers (Bedrock → OpenAI) without changing chat logic
- Swap storage (Firebase → Postgres) without changing services
- Mock all dependencies for unit testing
- Extract core logic into reusable packages

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Building features that depend on external services (AI, storage, messaging)
- Want to swap implementations without changing business logic
- Need testable code with mockable dependencies
- Building portable libraries that could be extracted into packages
- Working with multiple providers for the same capability

❌ **Don't use this pattern when:**
- Only one implementation will ever exist (over-engineering)
- The dependency is trivial and unlikely to change
- Performance is critical and interface indirection adds measurable overhead

---

## Core Principles

1. **Interface First**: Define the interface before writing any implementation
2. **Single Responsibility**: Each interface covers one capability (AI, storage, MCP, vision)
3. **Constructor Injection**: Implementations injected at construction time, not imported directly
4. **Param Objects**: Methods accept typed parameter objects, not positional arguments
5. **Callback-Based Streaming**: Use `onMessage` callbacks for streaming data rather than returning streams
6. **Optional Methods**: Use `method?` syntax for capabilities not all providers support

---

## Implementation

### Structure

```
src/
├── lib/
│   ├── chat/
│   │   ├── chat-engine.ts         # Core logic — depends on interfaces only
│   │   ├── types.ts               # Shared types
│   │   └── interfaces/
│   │       ├── ai-provider.ts     # IAIProvider interface
│   │       ├── storage-provider.ts # IStorageProvider interface
│   │       ├── mcp-provider.ts    # IMCPProvider interface
│   │       ├── vision-provider.ts # IVisionProvider interface
│   │       └── logger.ts         # ILogger interface
│   └── chat-providers/
│       ├── bedrock-ai-provider.ts         # IAIProvider → Bedrock
│       ├── firebase-storage-provider.ts   # IStorageProvider → Firebase
│       ├── mcp-provider.ts                # IMCPProvider → MCP SDK
│       └── google-vision-provider.ts      # IVisionProvider → Google
└── durable-objects/
    └── ChatRoom.ts                # Assembles and injects providers
```

### Code Example

#### Step 1: Define Provider Interfaces

```typescript
// src/lib/chat/interfaces/ai-provider.ts
import type { ChatEngineMessage } from '../types'

export interface IAIProvider {
  streamChat(params: StreamChatParams): Promise<void>
}

export interface StreamChatParams {
  messages: ChatMessage[]
  systemPrompt: string
  tools: Tool[]
  onMessage: (message: ChatEngineMessage) => void
  executeTool: (toolName: string, toolInput: any) => Promise<any>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}
```

```typescript
// src/lib/chat/interfaces/storage-provider.ts

export interface IStorageProvider {
  saveMessage(params: SaveMessageParams): Promise<Message>
  loadMessages(params: LoadMessagesParams): Promise<Message[]>
  ensureConversation(params: EnsureConversationParams): Promise<string>
  getConversation(params: GetConversationParams): Promise<Conversation | null>
  updateConversation(params: UpdateConversationParams): Promise<void>
  generateTitle?(params: GenerateTitleParams): Promise<string>  // Optional
  addToolCall(params: AddToolCallParams): Promise<string>
  updateToolCall(params: UpdateToolCallParams): Promise<void>
}

export interface SaveMessageParams {
  userId: string
  conversationId: string
  message: Message
}

export interface LoadMessagesParams {
  userId: string
  conversationId: string
  limit?: number
  startAfter?: string
}
```

```typescript
// src/lib/chat/interfaces/mcp-provider.ts

export interface IMCPProvider {
  getAvailableServers(params: GetAvailableServersParams): Promise<MCPServer[]>
  connectToServers(params: ConnectToServersParams): Promise<MCPConnection[]>
  getTools(connections: MCPConnection[]): Promise<Tool[]>
  executeTool(params: ExecuteToolParams): Promise<any>
  disconnect(connections: MCPConnection[]): Promise<void>
}
```

```typescript
// src/lib/chat/interfaces/vision-provider.ts

export interface IVisionProvider {
  analyzeImage(params: AnalyzeImageParams): Promise<VisionResult>
  processImagesInMessage(params: ProcessImagesParams): Promise<MessageContent>
}
```

#### Step 2: Create Engine with DI

```typescript
// src/lib/chat/chat-engine.ts
import type { IAIProvider } from './interfaces/ai-provider'
import type { IStorageProvider } from './interfaces/storage-provider'
import type { IMCPProvider } from './interfaces/mcp-provider'
import type { IVisionProvider } from './interfaces/vision-provider'
import type { ILogger } from './interfaces/logger'

interface ChatEngineConfig {
  aiProvider: IAIProvider
  storageProvider: IStorageProvider
  mcpProvider?: IMCPProvider      // Optional — not all apps need MCP
  visionProvider?: IVisionProvider // Optional — not all apps need vision
  logger: ILogger
}

export class ChatEngine {
  private ai: IAIProvider
  private storage: IStorageProvider
  private mcp?: IMCPProvider
  private vision?: IVisionProvider
  private logger: ILogger

  constructor(config: ChatEngineConfig) {
    this.ai = config.aiProvider
    this.storage = config.storageProvider
    this.mcp = config.mcpProvider
    this.vision = config.visionProvider
    this.logger = config.logger
  }

  async processMessage(params: ProcessMessageParams): Promise<void> {
    const { userId, conversationId, message, onMessage } = params

    // 1. Save user message
    const savedMessage = await this.storage.saveMessage({
      userId, conversationId, message: { ...message, role: 'user' }
    })
    onMessage({ type: 'user_message_saved', message: savedMessage })

    // 2. Load history
    const history = await this.storage.loadMessages({ userId, conversationId })

    // 3. Get tools (if MCP available)
    let tools: Tool[] = []
    if (this.mcp) {
      const servers = await this.mcp.getAvailableServers({ userId })
      const connections = await this.mcp.connectToServers({ servers, userId })
      tools = await this.mcp.getTools(connections)
    }

    // 4. Stream AI response
    await this.ai.streamChat({
      messages: history,
      systemPrompt: this.buildSystemPrompt(userId),
      tools,
      onMessage,
      executeTool: async (name, input) => {
        if (!this.mcp) throw new Error('No MCP provider')
        return this.mcp.executeTool({ toolName: name, toolInput: input, connections: [] })
      }
    })
  }

  async loadMessages(params: LoadMessagesParams) {
    return this.storage.loadMessages(params)
  }
}
```

#### Step 3: Inject Implementations in Durable Object

```typescript
// src/durable-objects/ChatRoom.ts
import { ChatEngine } from '@/lib/chat'
import {
  BedrockAIProvider,
  FirebaseStorageProvider,
  MCPProvider,
  GoogleVisionProvider
} from '@/lib/chat-providers'

export class ChatRoom extends DurableObject {
  private chatEngine: ChatEngine

  constructor(state: DurableObjectState, env: Env) {
    super(state, env)

    // Wire up all dependencies
    this.chatEngine = new ChatEngine({
      aiProvider: new BedrockAIProvider(),
      storageProvider: new FirebaseStorageProvider(),
      mcpProvider: new MCPProvider(),
      visionProvider: new GoogleVisionProvider(),
      logger: chatLogger
    })
  }
}
```

#### Step 4: Mock for Testing

```typescript
// src/__tests__/chat-engine.spec.ts
import { ChatEngine } from '@/lib/chat/chat-engine'

describe('ChatEngine', () => {
  const mockAI: IAIProvider = {
    streamChat: jest.fn(async ({ onMessage }) => {
      onMessage({ type: 'chunk', content: 'Hello!' })
      onMessage({ type: 'complete' })
    })
  }

  const mockStorage: IStorageProvider = {
    saveMessage: jest.fn(async (params) => ({ ...params.message, id: 'msg-1' })),
    loadMessages: jest.fn(async () => []),
    ensureConversation: jest.fn(async () => 'conv-1'),
    getConversation: jest.fn(async () => null),
    updateConversation: jest.fn(),
    addToolCall: jest.fn(async () => 'tc-1'),
    updateToolCall: jest.fn(),
  }

  it('should process message through providers', async () => {
    const engine = new ChatEngine({
      aiProvider: mockAI,
      storageProvider: mockStorage,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
    })

    const messages: any[] = []
    await engine.processMessage({
      userId: 'user1',
      conversationId: 'conv1',
      message: { content: 'Hi', role: 'user' },
      onMessage: (msg) => messages.push(msg)
    })

    expect(mockStorage.saveMessage).toHaveBeenCalled()
    expect(mockAI.streamChat).toHaveBeenCalled()
    expect(messages).toContainEqual({ type: 'chunk', content: 'Hello!' })
  })
})
```

---

## Benefits

### 1. Portable Business Logic
Core engine depends on interfaces, not implementations — extractable to npm package.

### 2. Provider Swapping
Change `BedrockAIProvider` to `OpenAIProvider` in one place (the constructor).

### 3. Full Testability
All external dependencies are mockable via interface substitution.

### 4. Incremental Adoption
Optional providers (MCP, vision) can be added later without changing existing code.

---

## Trade-offs

### 1. Interface Overhead
**Downside**: Additional files and indirection for each provider type.
**Mitigation**: Only create interfaces for dependencies you actually need to swap or mock.

### 2. Param Object Verbosity
**Downside**: Parameter objects are more verbose than positional arguments.
**Mitigation**: Provides better readability and extensibility (add fields without breaking callers).

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Direct Imports in Engine

```typescript
// ❌ BAD: Engine directly imports implementation
import { BedrockAIProvider } from '@/lib/chat-providers'

export class ChatEngine {
  private ai = new BedrockAIProvider()  // Tight coupling!
}

// ✅ GOOD: Engine accepts interface
export class ChatEngine {
  constructor(config: { aiProvider: IAIProvider }) {
    this.ai = config.aiProvider
  }
}
```

### ❌ Anti-Pattern 2: God Interface

```typescript
// ❌ BAD: One interface for everything
interface IChatProvider {
  streamChat(): void
  saveMessage(): void
  loadMessages(): void
  analyzeImage(): void
  getTools(): void
}

// ✅ GOOD: Separate interfaces per concern
interface IAIProvider { streamChat(): void }
interface IStorageProvider { saveMessage(): void; loadMessages(): void }
interface IVisionProvider { analyzeImage(): void }
```

---

## Related Patterns

- **[Durable Objects WebSocket](./tanstack-cloudflare.durable-objects-websocket.md)**: DOs inject providers into engines
- **[Library Services Pattern](./tanstack-cloudflare.library-services.md)**: Services can implement storage interfaces
- **[Zod Schema Validation](./tanstack-cloudflare.zod-schema-validation.md)**: Schemas define data shapes passed through interfaces

---

## Checklist for Implementation

- [ ] Interfaces defined in `interfaces/` directory
- [ ] Each interface covers one capability (single responsibility)
- [ ] Methods use typed parameter objects
- [ ] Optional providers marked with `?` in config
- [ ] Engine constructor accepts config object with all providers
- [ ] Implementations in separate `providers/` or `chat-providers/` directory
- [ ] Assembly (wiring) happens in Durable Object or server entry point
- [ ] Tests mock all providers via interface
- [ ] No direct implementation imports in engine code

---

**Status**: Stable - Core architectural pattern for pluggable systems
**Recommendation**: Use when building features with external dependencies that may change
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
