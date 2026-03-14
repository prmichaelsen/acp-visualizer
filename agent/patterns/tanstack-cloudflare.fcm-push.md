# FCM Push Notifications

**Category**: Architecture
**Applicable To**: Multi-device push notifications via Firebase Cloud Messaging with automatic stale token cleanup
**Status**: Stable

---

## Overview

Server-side FCM push notification delivery to all registered devices for a user. Tokens stored in Firestore per-user with hash-based document IDs for upsert. Invalid/expired tokens (`UNREGISTERED`, `INVALID_ARGUMENT`) are automatically removed on send failure. Integrated with the notification triggers service as the offline fallback when WebSocket is unavailable.

---

## Implementation

### FcmService

**File**: `src/services/fcm.service.ts`

```typescript
interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
}

class FcmService {
  static async sendToUser(userId: string, payload: PushNotificationPayload): Promise<number> {
    const tokens = await FcmTokenDatabaseService.getTokens(userId)
    if (tokens.length === 0) return 0

    let successCount = 0
    await Promise.all(tokens.map(async (token) => {
      try {
        await sendMessage({
          token: token.fcm_token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data,
        })
        successCount++
      } catch (error) {
        if (errMsg.includes('UNREGISTERED') || errMsg.includes('INVALID_ARGUMENT')) {
          await FcmTokenDatabaseService.removeTokenById(userId, token.id)  // Auto-cleanup
        }
      }
    }))
    return successCount
  }
}
```

### FcmTokenDatabaseService

**File**: `src/services/fcm-token-database.service.ts`

```typescript
interface FcmToken {
  id: string                          // Hash of fcm_token
  fcm_token: string
  platform: 'ios' | 'android' | 'web'
  created_at: string
  updated_at: string
}
// Collection: users/{userId}/fcm_tokens
// Document ID: hashToken(fcmToken)

class FcmTokenDatabaseService {
  static async upsertToken(userId, fcmToken, platform): Promise<FcmToken>
  static async removeToken(userId, fcmToken): Promise<void>
  static async removeTokenById(userId, tokenId): Promise<void>
  static async getTokens(userId): Promise<FcmToken[]>
}
```

### Client Registration

```typescript
// POST /api/mobile/register-fcm-token
// Body: { token: string, platform: 'ios' | 'android' | 'web' }
await FcmTokenDatabaseService.upsertToken(userId, token, platform)
```

### Delivery Strategy (with NotificationTriggers)

```typescript
// WebSocket-first, FCM-fallback
if (await NotificationHubService.isUserConnected(env, recipientId)) {
  await NotificationHubService.pushNotification(env, recipientId, notification)
} else {
  await FcmService.sendToUser(recipientId, { title, body, data })
}
```

---

## Checklist

- [ ] Token doc ID is hash of FCM token (enables upsert without duplicates)
- [ ] `sendToUser` sends to ALL registered tokens (multiple devices)
- [ ] Invalid tokens auto-removed on UNREGISTERED/INVALID_ARGUMENT errors
- [ ] Client registers token on app launch / permission grant
- [ ] Delivery strategy checks WebSocket first, falls back to FCM

---

## Related Patterns

- **[Notifications Engine](./tanstack-cloudflare.notifications-engine.md)**: WebSocket-first delivery that FCM falls back from

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
