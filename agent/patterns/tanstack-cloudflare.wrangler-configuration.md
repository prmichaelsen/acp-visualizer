# Wrangler Configuration Pattern

**Category**: Infrastructure
**Applicable To**: TanStack Start + Cloudflare Workers applications
**Status**: Stable

---

## Overview

The `wrangler.toml` file configures how your TanStack Start application runs on Cloudflare Workers. This pattern documents the complete configuration required for a production TanStack Start application, including Durable Object bindings, rate limiting, migrations, observability, and environment management.

Getting the wrangler configuration right is essential — incorrect settings can cause deployment failures, missing bindings, or production runtime errors.

---

## When to Use This Pattern

✅ **Use this pattern when:**
- Deploying TanStack Start applications to Cloudflare Workers
- Using Durable Objects for stateful features
- Need rate limiting, observability, or environment variables
- Setting up production deployment configuration

❌ **Don't use this pattern when:**
- Not using Cloudflare Workers
- Using Cloudflare Pages instead of Workers

---

## Core Principles

1. **Single Configuration File**: All Worker configuration in `wrangler.toml`
2. **Explicit Bindings**: All Durable Objects, rate limiters, and KV namespaces explicitly declared
3. **Migration Tags**: Durable Object class changes tracked via sequential migration tags
4. **Secrets via CLI**: Sensitive values stored as Cloudflare secrets, never in wrangler.toml
5. **Compatibility Date**: Pin to a specific date for API stability

---

## Implementation

### Complete wrangler.toml Reference

```toml
# ─── Basic Configuration ─────────────────────────────────────────────────────

name = "my-app"
main = "src/server.ts"
compatibility_date = "2026-02-10"
compatibility_flags = ["nodejs_compat"]

# ─── CPU Limits (Workers Paid) ────────────────────────────────────────────────

[limits]
cpu_ms = 300000  # 5 minutes (300,000 ms) — maximum for Workers Paid plan

# ─── Observability ────────────────────────────────────────────────────────────

[observability]
enabled = true

[observability.logs]
enabled = true
invocation_logs = true

# ─── Durable Objects ──────────────────────────────────────────────────────────

[[durable_objects.bindings]]
name = "CHAT_ROOM"
class_name = "ChatRoom"

[[durable_objects.bindings]]
name = "UPLOAD_MANAGER"
class_name = "UploadManager"

# ─── Durable Object Migrations ───────────────────────────────────────────────
# Tags must be sequential. Each deployment reads these to determine schema changes.

[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]

[[migrations]]
tag = "v2"
new_sqlite_classes = ["UploadManager"]

# To delete a Durable Object class:
# [[migrations]]
# tag = "v3"
# deleted_classes = ["ObsoleteClass"]

# ─── Rate Limiting ────────────────────────────────────────────────────────────
# namespace_id must be a string containing a positive integer

[[unsafe.bindings]]
name = "AUTH_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 5, period = 60 }

[[unsafe.bindings]]
name = "API_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1002"
simple = { limit = 100, period = 60 }

[[unsafe.bindings]]
name = "WS_RATE_LIMITER"
type = "ratelimit"
namespace_id = "1003"
simple = { limit = 10, period = 60 }

# ─── Environment Variables (non-secret) ──────────────────────────────────────
# [vars]
# APP_ENV = "production"
# LOG_LEVEL = "info"

# ─── Secrets (set via CLI, never in this file) ───────────────────────────────
# wrangler secret put AWS_ACCESS_KEY_ID
# wrangler secret put AWS_SECRET_ACCESS_KEY
# wrangler secret put FIREBASE_PROJECT_ID
# wrangler secret put FIREBASE_CLIENT_EMAIL
# wrangler secret put FIREBASE_PRIVATE_KEY
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { cloudflare } from '@opennextjs/cloudflare'
import { TanStackStartVite as tanstackStart } from '@tanstack/start/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    viteTsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
})
```

### TypeScript Env Types

```typescript
// src/env.d.ts (or generated via wrangler types)
interface Env {
  // Durable Objects
  CHAT_ROOM: DurableObjectNamespace
  UPLOAD_MANAGER: DurableObjectNamespace

  // Rate Limiters
  AUTH_RATE_LIMITER: RateLimit
  API_RATE_LIMITER: RateLimit
  WS_RATE_LIMITER: RateLimit

  // Secrets
  AWS_ACCESS_KEY_ID: string
  AWS_SECRET_ACCESS_KEY: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
}
```

---

## Configuration Sections Explained

### Basic Configuration

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Worker name (used in deployment) | `"my-app"` |
| `main` | Entry point file | `"src/server.ts"` |
| `compatibility_date` | Pin Cloudflare API version | `"2026-02-10"` |
| `compatibility_flags` | Enable Node.js APIs | `["nodejs_compat"]` |

### CPU Limits

| Field | Purpose | Default | Paid Plan Max |
|-------|---------|---------|---------------|
| `cpu_ms` | Max CPU time per request | 10ms (free) | 300,000ms (paid) |

### Durable Object Bindings

Each binding creates a `DurableObjectNamespace` accessible via `env.BINDING_NAME`:
- `name`: The binding name in your code (e.g., `env.CHAT_ROOM`)
- `class_name`: The exported class name in your source code

### Migrations

Migrations track Durable Object schema changes:
- `new_sqlite_classes`: New DO classes that use SQLite storage
- `new_classes`: New DO classes (without SQLite)
- `deleted_classes`: Classes being removed
- Tags must be sequential and never reused

### Secrets Management

```bash
# Upload individual secrets
wrangler secret put FIREBASE_PRIVATE_KEY

# Upload from .env file (script)
while IFS='=' read -r key value; do
  echo "$value" | wrangler secret put "$key"
done < .env.secrets
```

---

## Examples

### Example 1: Adding a New Durable Object

```toml
# 1. Add binding
[[durable_objects.bindings]]
name = "TASK_EXECUTOR"
class_name = "TaskExecutor"

# 2. Add migration (use next sequential tag)
[[migrations]]
tag = "v3"
new_sqlite_classes = ["TaskExecutor"]
```

### Example 2: Removing a Durable Object

```toml
# Migration to delete — add this, don't remove the binding yet
[[migrations]]
tag = "v4"
deleted_classes = ["TaskExecutor"]

# After deploying, remove the binding:
# [[durable_objects.bindings]]
# name = "TASK_EXECUTOR"
# class_name = "TaskExecutor"
```

### Example 3: Custom Domain Route

```toml
# Route to custom domain
[[routes]]
pattern = "app.example.com/*"
zone_name = "example.com"
```

---

## Benefits

### 1. Declarative Configuration
All infrastructure described in a single, version-controlled file.

### 2. Type-Safe Bindings
Generate TypeScript types with `wrangler types` for full type safety.

### 3. Sequential Migrations
Durable Object schema changes are tracked and applied in order.

### 4. Edge Observability
Built-in logging and invocation tracking without external services.

---

## Trade-offs

### 1. Rate Limiting Uses unsafe.bindings
**Downside**: The `unsafe.bindings` API may change in future Cloudflare versions.
**Mitigation**: Abstract rate limiting behind utility functions for easy migration.

### 2. No Environment Inheritance
**Downside**: No built-in way to share config between staging and production.
**Mitigation**: Use separate wrangler.toml files or environment sections.

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Secrets in wrangler.toml

```toml
# ❌ BAD: Secrets in config file (committed to git!)
[vars]
FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----..."

# ✅ GOOD: Use wrangler secret
# wrangler secret put FIREBASE_PRIVATE_KEY
```

### ❌ Anti-Pattern 2: Reusing Migration Tags

```toml
# ❌ BAD: Reusing tag "v1" after changing it
[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom", "UploadManager"]  # Changed!

# ✅ GOOD: Sequential tags, never modified
[[migrations]]
tag = "v1"
new_sqlite_classes = ["ChatRoom"]

[[migrations]]
tag = "v2"
new_sqlite_classes = ["UploadManager"]
```

### ❌ Anti-Pattern 3: Missing nodejs_compat

```toml
# ❌ BAD: Missing Node.js compatibility (crypto, Buffer, etc. won't work)
compatibility_flags = []

# ✅ GOOD: Enable Node.js compatibility
compatibility_flags = ["nodejs_compat"]
```

---

## Related Patterns

- **[Durable Objects WebSocket](./tanstack-cloudflare.durable-objects-websocket.md)**: DO bindings and migrations
- **[Rate Limiting](./tanstack-cloudflare.rate-limiting.md)**: Rate limiter bindings
- **[Auth Session Management](./tanstack-cloudflare.auth-session-management.md)**: Secret management for auth keys

---

## Checklist for Implementation

- [ ] `name` set to your worker name
- [ ] `main` points to server entry point
- [ ] `compatibility_date` set to recent date
- [ ] `nodejs_compat` flag enabled
- [ ] CPU limits configured for paid plan
- [ ] Observability and invocation logs enabled
- [ ] All Durable Objects have bindings
- [ ] Migrations use sequential, never-reused tags
- [ ] Rate limiters configured per endpoint category
- [ ] Secrets stored via `wrangler secret`, never in config
- [ ] Env types generated or manually maintained

---

**Status**: Stable - Essential configuration for Cloudflare Workers deployment
**Recommendation**: Review and customize for every new TanStack Start + Cloudflare project
**Last Updated**: 2026-02-28
**Contributors**: Patrick Michaelsen
