# Firebase Storage

**Category**: Code
**Applicable To**: All file upload/download, signed URL generation, image proxy, content moderation, and storage cleanup
**Status**: Stable

---

## Overview

This pattern covers how Firebase Storage is used via `@prmichaelsen/firebase-admin-sdk-v8` for file operations: chunked WebSocket uploads through a Durable Object, signed URL generation, server-side image proxy with ACL, content moderation via Google Cloud Vision, and storage cleanup on account deletion. The upload pipeline streams files from client → UploadManager DO → Firebase Storage with two-phase progress reporting.

---

## When to Use This Pattern

**Use this pattern when:**
- Adding a new file upload flow (new media type or storage path)
- Generating signed URLs for stored files
- Building an endpoint that serves or proxies stored files
- Adding content moderation to a new upload type
- Implementing storage cleanup for a new entity type

**Don't use this pattern when:**
- Storing structured data (use Firestore — see `tanstack-cloudflare.firebase-firestore`)
- Working with client-only file handling (canvas, blob URLs)
- Building external storage integrations (S3, R2, etc.)

---

## Core Principles

1. **WebSocket Streaming**: Uploads use chunked WebSocket messages through a Durable Object, bypassing request size limits
2. **Deny-All-Read Storage Rules**: Firebase Storage rules deny all direct reads — the image proxy (`/api/storage/image`) is the only access path
3. **Fail-Open Moderation**: If Google Vision API is down, uploads proceed — best-effort safety, never block on transient failures
4. **Metadata-Driven ACL**: File metadata (userId, conversationId) stored in Firebase is the source of truth for access control, not URL parameters
5. **Two-Phase Progress**: 0–50% = client-to-DO transfer, 50–100% = DO-to-Firebase upload

---

## Implementation

### Storage Path Structure

**File**: `src/constant/collections.ts`

```typescript
export const STORAGE_BASE = BASE.replace(/\./g, '_')
// Paths: {STORAGE_BASE}/users/{userId}/{path}/{mediaId}
```

| Media Type | Path | Example |
|---|---|---|
| Chat images | `['chat']` | `agentbase/users/abc/chat/media123` |
| Profile avatars | `['profile', 'avatar']` | `agentbase/users/abc/profile/avatar/media123` |
| Profile banners | `['profile', 'banner']` | `agentbase/users/abc/profile/banner/media123` |
| Widget images | `['profile', 'widgets']` | `agentbase/users/abc/profile/widgets/media123` |

### Upload Flow

```
Client (upload-client.ts)          UploadManager DO              Firebase Storage
  │                                    │                              │
  ├─ WebSocket connect ──────────►     │                              │
  ├─ init { userId, path, size } ──►   │                              │
  │  ◄─── ready ──────────────────     │                              │
  ├─ chunk (256KB base64) ────────►    │ (buffers in memory)          │
  ├─ chunk ────────────────────────►   │                              │
  ├─ chunk (final) ────────────────►   │                              │
  │   (0-50% progress)                 │                              │
  │                                    ├─ Content moderation ────►    │
  │  ◄─── moderating ─────────────    │  (Vision SafeSearch)         │
  │  ◄─── moderation_result ──────    │                              │
  │                                    ├─ uploadFileResumable() ────► │
  │  ◄─── firebase_progress ──────    │  (1MB chunks, 50-100%)      │
  │                                    │  ◄───── upload complete ──── │
  │                                    ├─ generateSignedUrl() ──────► │
  │  ◄─── success { signedUrl } ───   │  ◄───── signed URL ──────── │
```

### Key SDK Functions

```typescript
import {
  uploadFileResumable,  // Upload with progress tracking
  generateSignedUrl,    // Time-limited read URLs
  downloadFile,         // Download file buffer
  getFileMetadata,      // File metadata (content-type, custom metadata)
  listFiles,            // Paginated file listing
  deleteFile,           // Delete single file
} from '@prmichaelsen/firebase-admin-sdk-v8'
```

### UploadManager Durable Object

**File**: `src/durable-objects/UploadManager.ts`

Upload to Firebase with progress:

```typescript
await uploadFileResumable(storagePath, completeBuffer, contentType, {
  chunkSize: 1024 * 1024, // 1MB chunks to Firebase
  onProgress: (uploaded, total) => {
    const pct = 50 + Math.round((uploaded / total) * 50) // 50-100% phase
    ws.send(JSON.stringify({ type: 'firebase_progress', progress: pct }))
  },
  metadata: {
    userId,
    path: path.join('/'),
    uploadedAt: new Date().toISOString(),
    ...customMetadata,
  },
})
```

Generate signed URL after upload:

```typescript
const expiresAt = new Date(Date.now() + expiresIn * 1000)
const signedUrl = await generateSignedUrl(storagePath, {
  action: 'read',
  expires: expiresAt,
})
```

### Content Moderation

**File**: `src/constant/moderation.ts`

```typescript
export const MODERATION_CONFIG = {
  adult: {
    reject: ['VERY_LIKELY'] as const,
    warn: ['LIKELY', 'POSSIBLE'] as const,
  },
  violence: {
    reject: ['VERY_LIKELY'] as const,
    warn: ['LIKELY', 'POSSIBLE'] as const,
  },
  racy: {
    reject: [] as const, // Never reject on racy alone
    warn: [] as const,
  },
  failOpen: true,  // Allow upload if Vision API fails
  skipContentTypes: ['image/svg+xml'],
}
```

Moderation is skipped for: video files, SVG images, and `skipModeration: true` uploads (e.g., profile avatars use a separate moderation flow).

### Image Proxy (ACL Enforcement)

**File**: `src/routes/api/storage/image.tsx`

Access tiers (checked in order):
1. **Owner**: Requesting user === file owner → allow
2. **Profile images**: Path contains `/profile/` → allow (public)
3. **Space content**: Path contains `/spaces/` → allow (public)
4. **Chat DM**: Query conversation, validate participant membership
5. **Chat Group**: Query conversation, validate `can_read` permission
6. **Deny**: All others → 403

```typescript
// Download and serve the file
const buffer = await downloadFile(storagePath)
const metadata = await getFileMetadata(storagePath)

return new Response(buffer, {
  headers: {
    'Content-Type': metadata.contentType || 'application/octet-stream',
    'Cache-Control': isPublic ? 'public, max-age=3300' : 'private, max-age=3300',
    'X-Crop-X': cropData?.x?.toString() ?? '',
    // ... other crop metadata headers
  },
})
```

### MediaStorageService (Domain Wrapper)

**File**: `src/services/media-storage.service.ts`

High-level methods that set path and metadata for each use case:

```typescript
static async saveChatImage(file, userId, conversationId, messageId, callbacks) {
  return uploadToStorage(file, userId, {
    path: ['chat'],
    metadata: { conversationId, messageId, mediaType: 'image' },
    ...callbacks,
  })
}

static async saveProfileAvatar(file, userId, callbacks) {
  return uploadToStorage(file, userId, {
    path: ['profile', 'avatar'],
    metadata: { mediaType: 'avatar' },
    skipModeration: true,  // Uses separate moderation flow
    ...callbacks,
  })
}
```

---

## Examples

### Example 1: Downloading a File for AI Processing

**File**: `src/lib/chat/message-formatter.ts`

```typescript
import { downloadFile } from '@prmichaelsen/firebase-admin-sdk-v8'

const buffer = await downloadFile(storagePath)
let text = new TextDecoder('utf-8').decode(buffer)
const MAX_FILE_BYTES = 50 * 1024
if (text.length > MAX_FILE_BYTES) {
  text = text.slice(0, MAX_FILE_BYTES) + '...[truncated]'
}
content.push({ type: 'text', text: `[File: ${fileName}]\n${text}\n[End File]` })
```

### Example 2: Bulk Storage Cleanup on Account Deletion

**File**: `src/services/account-deletion.service.ts`

```typescript
import { listFiles, deleteFile } from '@prmichaelsen/firebase-admin-sdk-v8'

const prefix = `${STORAGE_BASE}/users/${userId}/`
let pageToken: string | undefined

do {
  const listResult = await listFiles({
    prefix,
    maxResults: 500,
    ...(pageToken ? { pageToken } : {}),
  })

  for (const file of listResult.files) {
    await deleteFile(file.name)
  }

  pageToken = listResult.nextPageToken
} while (pageToken)
```

### Example 3: Crop Metadata Storage

**File**: `src/services/media-crop-database.service.ts`

Crop coordinates stored in Firestore at `{BASE}.users/{userId}/media-crops/{mediaId}`:

```typescript
static async setCrop(userId: string, mediaId: string, storagePath: string, crop: CropData) {
  const collection = getUserMediaCropsCollection(userId)
  await setDocument(collection, mediaId, {
    media_id: mediaId,
    storage_path: storagePath,
    crop,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
}
```

Crop metadata returned as response headers from the image proxy:
`X-Crop-X`, `X-Crop-Y`, `X-Crop-Width`, `X-Crop-Height`, `X-Image-Width`, `X-Image-Height`

---

## Anti-Patterns

### Serving Files Directly from Signed URLs

```typescript
// Bad: Bypasses ACL — anyone with the URL can access
const url = await generateSignedUrl(path, { action: 'read', expires })
return new Response(JSON.stringify({ url }))  // Client fetches directly

// Good: Proxy through server with ACL checks
const buffer = await downloadFile(path)
// ... validate ACL ...
return new Response(buffer, { headers: { 'Content-Type': contentType } })
```

### Trusting URL Parameters for ACL

```typescript
// Bad: Client-supplied conversationId used for access check
const convId = url.searchParams.get('conversationId')

// Good: Read conversationId from file metadata (server source of truth)
const metadata = await getFileMetadata(storagePath)
const convId = metadata.metadata?.conversationId
```

### Blocking Uploads on Moderation Failure

```typescript
// Bad: API error blocks the upload entirely
const result = await VisionService.analyzeImage(buffer)
if (!result) throw new Error('Moderation failed')  // Blocks upload

// Good: Fail open — allow upload if Vision API is unavailable
try {
  const result = await VisionService.analyzeImage(buffer)
  if (shouldReject(result)) { reject(); return }
} catch {
  // Vision API down — allow upload (fail-open)
}
```

---

## Key Design Decisions

### Upload Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Upload transport | WebSocket via Durable Object | Bypasses HTTP body size limits; enables progress tracking |
| Chunk size (client→DO) | 256KB | Stays under 1MiB Cloudflare WebSocket message limit after base64 |
| Chunk size (DO→Firebase) | 1MB | Optimal for Firebase resumable uploads |
| DO instance key | `idFromName(userId)` | One DO per user; consistent instance across uploads |

### Security

| Decision | Choice | Rationale |
|---|---|---|
| Storage rules | Deny-all-read | Forces all access through server-side ACL proxy |
| ACL source of truth | File metadata (not URL params) | Prevents parameter tampering |
| Moderation strategy | Fail-open, reject only VERY_LIKELY | Minimizes false positives while catching obvious violations |
| Video uploads | Blocked entirely | No moderation pipeline for video yet |

### Performance

| Decision | Choice | Rationale |
|---|---|---|
| Image proxy caching | `max-age=3300` (~55 min) | Balances freshness with CDN efficiency |
| Usage tracking | Fire-and-forget after upload | Don't block upload success on quota tracking |
| Image compression | Client-side to ≤1568px, 0.85 JPEG | Claude-optimal size; reduces upload time |

---

## Checklist for Implementation

- [ ] Storage path uses `STORAGE_BASE` constant, not hardcoded prefix
- [ ] New upload type added to `MediaStorageService` with correct path and metadata
- [ ] Content moderation configured for new image upload types (skip for non-images)
- [ ] Image proxy updated with ACL rules for new access patterns
- [ ] `UsageDatabaseService.incrementStorage()` called after successful upload
- [ ] Account deletion cleanup handles new storage paths
- [ ] Client-side image compression applied before upload (if applicable)

---

## Related Patterns

- **[Firebase Auth](./tanstack-cloudflare.firebase-auth.md)**: Auth verification required before upload and download operations
- **[Firebase Firestore](./tanstack-cloudflare.firebase-firestore.md)**: Crop metadata and usage tracking stored in Firestore
- **[Database Service Conventions](./database-service-conventions.md)**: MediaCropDatabaseService follows standard conventions

---

**Status**: Stable
**Recommendation**: Follow this pattern for all new file upload/download features. Always proxy through the image API — never expose signed URLs directly to clients.
**Last Updated**: 2026-03-14
**Contributors**: Community
