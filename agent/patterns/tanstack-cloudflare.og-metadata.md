# OG Metadata Pattern

**Category**: Code
**Applicable To**: TanStack Start routes that need social media link previews (Open Graph + Twitter Cards)
**Status**: Stable

---

## Overview

Every route that can be shared on social media (iMessage, Slack, Discord, Twitter/X, Facebook) needs server-rendered Open Graph and Twitter Card meta tags in the HTML `<head>`. TanStack Start provides a `head()` function on route definitions that runs during SSR — this is the only mechanism that works for social crawlers, which do not execute JavaScript.

This pattern documents how to add OG metadata to routes, covering static pages, dynamic content pages with SSR loader data, and the global defaults that all routes inherit.

---

## When to Use This Pattern

**Use this pattern when:**
- Adding a new route that users might share (link previews)
- Adding SSR data to a route that already has OG tags
- Creating shareable content pages (memories, profiles, invite links)
- Debugging why a shared link shows the wrong preview

**Don't use this pattern when:**
- The route is behind authentication with no public preview needed
- The route is an API endpoint (`/api/*`)

---

## Core Principles

1. **SSR-Only**: Social crawlers don't run JS — `head()` runs server-side so tags appear in the initial HTML response
2. **Route-Level Overrides**: Child route `head()` tags override parent (root) defaults by property
3. **Graceful Fallback**: If loader data fails, return generic site-level OG tags — never render a page with no OG
4. **Auth After Meta**: For shareable links (invite codes), check auth in the component, not `beforeLoad`, so crawlers see meta tags without being redirected

---

## Implementation

### Global Defaults (Root Route)

`src/routes/__root.tsx` defines site-wide fallback OG tags via `createRootRoute({ head() })`:

```typescript
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, ...' },
      { title: 'agentbase — social AI with memory, ghosts, and shared spaces' },
      { name: 'description', content: 'A social AI platform with persistent memory...' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'agentbase' },
      { property: 'og:title', content: 'agentbase — social AI with memory, ghosts, and shared spaces' },
      { property: 'og:description', content: 'A social AI platform with persistent memory...' },
      { property: 'og:image', content: 'https://agentbase.me/icon-512x512.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'agentbase — ...' },
      { name: 'twitter:description', content: '...' },
      { name: 'twitter:image', content: 'https://agentbase.me/icon-512x512.png' },
    ],
  }),
  component: RootComponent,
})
```

The root also renders `<HeadContent />` inside `<head>` to inject these tags into the HTML.

### Static Page OG

For pages with fixed content (terms, privacy, homepage, invite links):

```typescript
export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms of Service — agentbase' },
      { name: 'description', content: 'Terms of service for agentbase.' },
      { property: 'og:title', content: 'Terms of Service — agentbase' },
      { property: 'og:description', content: 'Terms of service for agentbase.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'agentbase' },
      { property: 'og:image', content: 'https://agentbase.me/icon-512x512.png' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: 'Terms of Service — agentbase' },
      { name: 'twitter:description', content: 'Terms of service for agentbase.' },
      { name: 'twitter:image', content: 'https://agentbase.me/icon-512x512.png' },
    ],
  }),
  component: TermsPage,
})
```

### Dynamic Content OG (SSR Loader)

For pages where OG tags depend on data (memory detail, profile), use `createServerFn` + `loader` + `head(loaderData)`:

```typescript
// 1. Server function fetches data during SSR
const fetchMemoryDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { memoryId: string }) => data)
  .handler(async ({ data }) => {
    // Fetch memory from backend
    const memory = await svc.memories.get(userId, data.memoryId)
    return { memory }
  })

// 2. Route loader calls server function
export const Route = createFileRoute('/memories/$memoryId')({
  loader: async ({ params }) => {
    const memoryData = await fetchMemoryDetail({ data: { memoryId: params.memoryId } })
    return { memoryData }
  },

  // 3. head() receives loader data and generates dynamic tags
  head: (({ loaderData }: any) => {
    const memory = loaderData?.memoryData?.memory
    if (!memory) {
      return {
        meta: [
          { title: 'Memory — agentbase' },
          { property: 'og:title', content: 'Memory — agentbase' },
          { property: 'og:image', content: 'https://agentbase.me/icon-512x512.png' },
          // ... fallback tags
        ],
      }
    }

    const rawTitle = memory.title || memory.content?.split('\n')[0] || 'Memory'
    const title = rawTitle.length > 60 ? rawTitle.substring(0, 57) + '...' : rawTitle
    const description = (memory.content ?? '').substring(0, 200)

    return {
      meta: [
        { title: `${title} — agentbase` },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:site_name', content: 'agentbase' },
        { property: 'og:image', content: 'https://agentbase.me/icon-512x512.png' },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: 'https://agentbase.me/icon-512x512.png' },
      ],
    }
  }) as any,

  component: MemoryDetailPage,
})
```

### Dynamic OG Image (Profile Pages)

Profile pages use the `/api/storage/image` proxy to serve user-uploaded profile pictures as OG images:

```typescript
head: (({ loaderData }: any) => {
  const profile = loaderData?.profileForHead
  if (profile && profile.is_published) {
    const image = profile.profile_picture_path
      ? `https://agentbase.me/api/storage/image?path=${encodeURIComponent(profile.profile_picture_path)}&context=profile`
      : 'https://agentbase.me/icon-512x512.png'

    return {
      meta: [
        { property: 'og:image', content: image },
        { name: 'twitter:image', content: image },
        // ... other tags
      ],
    }
  }
  // fallback for unpublished profiles
}) as any
```

### Shareable Invite Links (Auth After Meta)

For pages like `/friend-links/$code`, `/group-links/$code`, `/dm-links/$code` — use **static OG** and defer auth to the component:

```typescript
export const Route = createFileRoute('/friend-links/$code')({
  // Static head — no loader needed, crawlers see this immediately
  head: () => ({
    meta: [
      { title: 'Friend Invite — agentbase' },
      { property: 'og:title', content: 'Friend Invite — agentbase' },
      { property: 'og:description', content: "You've been invited to connect on agentbase." },
      // ...
    ],
  }),
  // Auth check happens HERE, not in beforeLoad — crawlers never hit this
  component: FriendLinkPage,
})
```

---

## Required Meta Tags Checklist

Every route with OG metadata should include all of these:

| Tag | Property | Notes |
|-----|----------|-------|
| `<title>` | `{ title: '...' }` | Browser tab title |
| `description` | `{ name: 'description', content: '...' }` | Search engine description |
| `og:title` | `{ property: 'og:title', content: '...' }` | Social card title |
| `og:description` | `{ property: 'og:description', content: '...' }` | Social card description |
| `og:type` | `{ property: 'og:type', content: '...' }` | `website` or `article` |
| `og:site_name` | `{ property: 'og:site_name', content: 'agentbase' }` | Always `agentbase` |
| `og:image` | `{ property: 'og:image', content: '...' }` | Absolute URL, min 200x200 |
| `twitter:card` | `{ name: 'twitter:card', content: '...' }` | `summary` or `summary_large_image` |
| `twitter:title` | `{ name: 'twitter:title', content: '...' }` | Same as `og:title` |
| `twitter:description` | `{ name: 'twitter:description', content: '...' }` | Same as `og:description` |
| `twitter:image` | `{ name: 'twitter:image', content: '...' }` | Same as `og:image` |

---

## OG Type Reference

| Route Type | `og:type` | `twitter:card` |
|------------|-----------|----------------|
| Homepage / static pages | `website` | `summary_large_image` |
| Memory detail | `article` | `summary` |
| Profile page | `profile` | `summary` |
| Space / group pages | `website` | `summary` |
| Invite links | `website` | `summary` |

---

## Anti-Patterns

### Auth in beforeLoad for shareable pages

**Description**: Redirecting unauthenticated users in `beforeLoad` before `head()` runs.

**Why it's bad**: Social crawlers are unauthenticated — they get redirected to login and never see OG tags.

**Instead**: Check auth in the component, not `beforeLoad`. The `head()` function runs regardless.

### Missing fallback when loader fails

**Description**: Not handling the case where `loaderData` is undefined in `head()`.

**Why it's bad**: A failed fetch produces a page with no OG tags — shared links show a blank preview.

**Instead**: Always return fallback OG tags when data is missing.

### Relative OG image URLs

**Description**: Using `/icon-512x512.png` instead of `https://agentbase.me/icon-512x512.png`.

**Why it's bad**: Some social crawlers don't resolve relative URLs.

**Instead**: Always use absolute URLs for `og:image` and `twitter:image`.

---

## Implementation References

- **Root defaults**: `src/routes/__root.tsx` (lines 56-108)
- **Memory detail (dynamic)**: `src/routes/memories/$memoryId.tsx` (lines 131-160)
- **Profile (dynamic image)**: `src/routes/profile/$userId.tsx` (lines 90-127)
- **Spaces (conditional image)**: `src/routes/spaces/$spaceId.tsx` (lines 41-53)
- **Invite links (static, auth-deferred)**: `src/routes/friend-links/$code.tsx` (lines 15-29)
- **Image proxy**: `src/routes/api/storage/image.tsx`
- **Static assets**: `public/icon-512x512.png`, `public/the_void_02-512.png`

## Related Patterns

- **[SSR Preload](./ssr-preload.md)**: Server-side data loading that feeds into `head()` for dynamic OG
- **[Firebase Auth](./tanstack-cloudflare.firebase-auth.md)**: Auth patterns — important to understand which routes gate auth in `beforeLoad` vs component
- **[Firebase Storage](./tanstack-cloudflare.firebase-storage.md)**: Image proxy endpoint used for dynamic OG images

---

## Checklist for Implementation

- [ ] `head()` function defined on route with all required meta tags
- [ ] `og:image` and `twitter:image` use absolute URLs
- [ ] Dynamic pages have server function + loader feeding `head(loaderData)`
- [ ] `head()` handles missing/failed loader data with fallback tags
- [ ] Shareable pages defer auth to component (not `beforeLoad`)
- [ ] Title truncated to 60 chars max, description to 200 chars max
- [ ] `og:type` is appropriate (`website` vs `article` vs `profile`)
- [ ] `og:site_name` is `agentbase`

---

**Status**: Stable
**Recommendation**: Follow this pattern for every new route. Verify OG tags by pasting the URL into the Twitter Card Validator or Facebook Sharing Debugger.
**Last Updated**: 2026-03-14
**Contributors**: Community
