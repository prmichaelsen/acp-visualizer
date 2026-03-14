# Notifications Engine

**Category**: Architecture
**Applicable To**: Real-time push notifications via WebSocket with multi-tab sync, exponential backoff, and FCM fallback for offline users
**Status**: Stable

---

## Overview

A three-layer notification system: NotificationsEngine (client WebSocket with event subscriptions), NotificationHub (per-user Durable Object broadcasting to all connected tabs), and NotificationTriggers (server-side delivery with WebSocket-first, FCM-fallback strategy). Notifications flow in real-time to all open tabs; when the user is offline, FCM push notifications deliver instead.

---

## Implementation

### NotificationsEngine (Client)

**File**: `src/lib/notifications/notifications-engine.ts`

```typescript
type NotificationEventType = 'notification' | 'notification_read' | 'notification_removed'
                            | 'unread_count' | 'connection_change'

class NotificationsEngine {
  private ws: WebSocket | null = null
  private handlers: Map<NotificationEventType, Set<EventHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private intentionalClose = false

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.ws = new WebSocket(`${protocol}//${location.host}/api/notifications-ws`)
    this.ws.onopen = () => { this.reconnectAttempts = 0; this.emit('connection_change', { connected: true }) }
    this.ws.onmessage = (e) => { const data = JSON.parse(e.data); this.emit(data.type, data) }
    this.ws.onclose = () => { this.emit('connection_change', { connected: false }); this.attemptReconnect() }
  }

  on<T extends NotificationEventType>(event: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => { this.handlers.get(event)?.delete(handler) }  // Unsubscribe
  }

  disconnect() { this.intentionalClose = true; this.ws?.close() }
}
```

Backoff: `1000 * 2^(attempt-1)` — 1s, 2s, 4s, ... 512s, then give up after 10 attempts.

### NotificationHub (Server — Durable Object)

**File**: `src/durable-objects/NotificationHub.ts`

```typescript
class NotificationHub extends DurableObject {
  private sessions: Set<WebSocket> = new Set()

  async fetch(request: Request) {
    if (url.pathname === '/broadcast') {
      const event = await request.json()
      this.broadcast(event)  // Send to all connected tabs
      return new Response('ok')
    }
    if (url.pathname === '/connected') {
      return Response.json({ connected: this.sessions.size > 0, count: this.sessions.size })
    }
    // WebSocket upgrade
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    this.sessions.add(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  private broadcast(event: NotificationEvent) {
    for (const ws of this.sessions) {
      try { ws.send(JSON.stringify(event)) }
      catch { this.sessions.delete(ws) }  // Clean dead connections
    }
  }
}
```

One DO instance per user (`idFromName(userId)`). Push-only channel — clients don't send messages.

### NotificationTriggers (Delivery Strategy)

**File**: `src/services/notification-triggers.service.ts`

```typescript
private static async deliver(recipientId, notification, pushData?, env?) {
  if (env) {
    const connected = await NotificationHubService.isUserConnected(env, recipientId)
    if (connected) {
      // In-app: WebSocket only (updates bell badge instantly)
      await NotificationHubService.pushNotification(env, recipientId, notification)
      return
    }
  }
  // Offline: FCM push notification
  await FcmService.sendToUser(recipientId, { title: notification.title, body: notification.message })
}
```

### Multi-Tab Sync

When any tab marks a notification as read:
1. API updates Firestore
2. API broadcasts `notification_read` to NotificationHub
3. Hub sends to ALL connected tabs
4. Each tab's `engine.on('notification_read')` decrements unread count

### Component Integration

```typescript
function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const engineRef = useRef<NotificationsEngine | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    const engine = new NotificationsEngine(user.uid)

    engine.on('notification', () => setUnreadCount(c => c + 1))
    engine.on('notification_read', () => setUnreadCount(c => Math.max(0, c - 1)))
    engine.on('notification_removed', () => refetchCount())

    engine.connect()
    engineRef.current = engine
    return () => engine.disconnect()
  }, [user?.uid])
}
```

---

## Checklist

- [ ] One NotificationHub DO per user (`idFromName(userId)`)
- [ ] Engine `on()` returns unsubscribe function — call it on unmount
- [ ] Delivery checks WebSocket connectivity first, falls back to FCM
- [ ] API endpoints broadcast changes for multi-tab sync
- [ ] Push-only WebSocket — clients receive, never send

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
