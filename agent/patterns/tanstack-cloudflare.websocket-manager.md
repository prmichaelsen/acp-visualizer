# WebSocket Manager

**Category**: Architecture
**Applicable To**: Real-time WebSocket connections with auto-reconnect, visibility recovery, and discriminated union message types
**Status**: Stable

---

## Overview

A class-based WebSocket client (`ChatWebSocket`) with exponential backoff reconnection (5 attempts, 1s base), page visibility recovery, discriminated union message types, and init-based pre-warming. The server side uses a Cloudflare Durable Object (`ChatRoom`) for session multiplexing with ACL-filtered broadcasting. Each component instance creates its own WebSocket with proper message handlers.

---

## Implementation

### ChatWebSocket Client

**File**: `src/lib/chat/websocket.ts`

```typescript
interface ChatWebSocketConfig {
  userId: string
  conversationId?: string
  ghostOwner?: string
  onMessage: (message: WebSocketMessage) => void
}

class ChatWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000         // Base delay (ms)
  private intentionalDisconnect = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private visibilityHandler: (() => void) | null = null
}
```

### Connection Lifecycle

```
connect()
  ├─ Set intentionalDisconnect = false
  ├─ Clean up old visibility handler
  ├─ Cancel pending reconnect timer
  ├─ Close zombie WebSocket (clear handlers first)
  ├─ Construct URL: wss://{host}/api/chat-ws?userId=X&conversationId=Y
  └─ Create new WebSocket
      ├─ onopen:
      │   ├─ Reset reconnectAttempts = 0
      │   ├─ Emit connection_change { connected: true }
      │   └─ Send init message (triggers server pre-warming)
      ├─ onmessage: Parse JSON → handleMessage(data)
      ├─ onerror: Emit error event
      └─ onclose:
          ├─ Emit connection_change { connected: false }
          ├─ Register visibilitychange handler
          └─ attemptReconnect()
```

### Reconnection (Exponential Backoff)

```typescript
private attemptReconnect() {
  if (this.intentionalDisconnect) return
  if (this.reconnectAttempts >= this.maxReconnectAttempts) {
    this.config.onMessage({ type: 'error', error: 'Failed to reconnect' })
    return
  }
  this.reconnectAttempts++
  const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
  // Sequence: 1s, 2s, 4s, 8s, 16s → give up
  this.reconnectTimer = setTimeout(() => this.connect(), delay)
}
```

### Visibility Recovery

When the tab becomes visible and the WebSocket is dead, reconnect immediately with reset retry counter:

```typescript
this.visibilityHandler = () => {
  if (document.visibilityState === 'visible' &&
      (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
    this.reconnectAttempts = 0
    this.connect()
  }
}
document.addEventListener('visibilitychange', this.visibilityHandler)
```

### Discriminated Union Message Types

```typescript
type WebSocketMessage =
  | { type: 'chunk'; content: string }
  | { type: 'tool_call'; toolCall: ToolCall; persistedToolCallId?: string }
  | { type: 'tool_result'; toolResult: ToolResult; persistedToolCallId?: string }
  | { type: 'message'; message: Message }
  | { type: 'messages_loaded'; messages: Message[]; hasMore: boolean }
  | { type: 'connection_change'; connected: boolean }
  | { type: 'complete' }
  | { type: 'cancelled' }
  | { type: 'error'; error: string }
  | { type: 'generation_in_progress' }
  | { type: 'token_limit_warning'; percentage: number; estimatedTokens: number; maxTokens: number }
  | { type: 'progress_start'; toolCallId: string; command: string }
  | { type: 'progress_update'; toolCallId: string; output: string }
  | { type: 'progress_complete'; toolCallId: string; exitCode: number }
  | { type: 'progress_error'; toolCallId: string; error: string }
  | { type: 'status'; serverName?: string; statusMessage?: string }
  | { type: 'conversation_created'; conversationId: string }
  | { type: 'usage'; input_tokens: number; output_tokens: number }
```

### Sending Messages

```typescript
sendMessage(content: string | ContentBlock[], conversationId?: string) {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    this.config.onMessage({ type: 'error', error: 'Not connected' })
    return
  }
  this.ws.send(JSON.stringify({
    type: 'message', message: content,
    userId: this.config.userId, conversationId, ghostOwner: this.config.ghostOwner,
  }))
}

cancelGeneration(conversationId?: string) { /* send type: 'cancel' */ }
loadMessages(conversationId: string, limit?: number, startAfter?: string) { /* send type: 'load_messages' */ }
```

### Graceful Disconnect

```typescript
disconnect() {
  this.intentionalDisconnect = true
  clearTimeout(this.reconnectTimer)
  document.removeEventListener('visibilitychange', this.visibilityHandler)
  if (this.ws) {
    this.ws.onclose = null; this.ws.onmessage = null; this.ws.onerror = null
    this.ws.close()
    this.ws = null
  }
}
```

### Component Integration

```typescript
// Each ChatInterface creates its own WebSocket
useEffect(() => {
  if (!user) return
  const ws = new ChatWebSocket({
    userId: user.uid,
    conversationId,
    ghostOwner,
    onMessage: (msg) => {
      switch (msg.type) {
        case 'chunk': /* append to streaming blocks */ break
        case 'message': /* add to message list */ break
        case 'complete': /* finalize assistant message */ break
        // ...
      }
    },
  })
  ws.connect()
  wsClientRef.current = ws
  return () => ws.disconnect()
}, [user, conversationId, ghostOwner])
```

### Server: Init Pre-Warming

On `init` message, the ChatRoom DO:
1. Registers user session
2. Loads last 50 messages from Firestore
3. Sends `messages_loaded` event
4. If active generation exists, sends `generation_in_progress`
5. Sends `ready` signal

### Server: ACL-Filtered Broadcasting

```typescript
private broadcastMessage(message: ServerMessage, conversationId?: string) {
  for (const [socket, userId] of this.sessions.entries()) {
    if (conversationId && this.sessionConversations.get(socket) !== conversationId) continue
    if (message.visible_to_user_ids && !message.visible_to_user_ids.includes(userId)) continue
    socket.send(JSON.stringify(message))
  }
}
```

---

## Anti-Patterns

### Sharing a Single WebSocket Across Components

```typescript
// Bad: Pre-connected WebSocket has no-op handlers — messages get lost
const ws = useWebSocketManager()  // Returns shared instance
<ChatInterface ws={ws} />         // Can't register proper handlers

// Good: Each component creates its own WebSocket
const ws = new ChatWebSocket({ userId, conversationId, onMessage: handleMessage })
```

### Not Clearing Handlers Before Closing

```typescript
// Bad: Old onclose fires and triggers reconnect
this.ws.close()

// Good: Clear handlers first
this.ws.onclose = null; this.ws.onmessage = null; this.ws.onerror = null
this.ws.close()
```

---

## Checklist

- [ ] Each component creates its own `ChatWebSocket` instance
- [ ] `onMessage` handler covers all discriminated union cases
- [ ] `disconnect()` called on component unmount
- [ ] Visibility handler registered for tab recovery
- [ ] Event handlers cleared before closing WebSocket
- [ ] Server broadcasts filter by conversationId + ACL visibility

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
