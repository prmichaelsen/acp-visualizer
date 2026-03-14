# Searchable Settings Page

**Category**: Design
**Applicable To**: Settings pages with grouped sections, search-to-scroll, hash-based navigation, and a registry of searchable items
**Status**: Stable

---

## Overview

The Settings page uses a registry-based architecture: all settings are defined in a central `SettingsItem[]` array with name, description, category, hidden keywords, and a hash-fragment path. A search input filters the registry using AND-logic word matching, and selecting a result navigates to the route + scrolls to the section via its `id` attribute. This makes settings discoverable without browsing every section.

---

## When to Use This Pattern

**Use this pattern when:**
- Building a settings page with many sections that benefit from search
- Any page with hash-based scroll-to-section navigation
- Settings that span multiple sub-pages (main settings, ghost settings, delete account)

**Don't use this pattern when:**
- The page has fewer than 5 settings (just list them, no search needed)
- Settings are entirely form-based with no sections (use a simple form)

---

## Core Principles

1. **Registry as Source of Truth**: All searchable settings defined in one `SettingsItem[]` array
2. **Hidden Keywords**: Extra search terms (`keywords[]`) improve discoverability without cluttering the UI
3. **AND-Logic Search**: All query words must match in the concatenated haystack
4. **Hash-Fragment Navigation**: Search results link to `path#section-id`, scrolling to the section
5. **Optimistic Updates**: Toggle/slider changes apply immediately, revert on API failure

---

## Implementation

### Settings Registry

**File**: `src/constant/settings-registry.ts`

```typescript
export interface SettingsItem {
  /** Unique identifier, also used as Algolia objectID */
  id: string
  /** Display name shown in search results */
  name: string
  /** Short description shown under the name */
  description: string
  /** Category grouping (e.g. "Ghost Mode", "Privacy", "Display") */
  category: string
  /** Extra search terms not visible in UI (e.g. "telemetry" for analytics) */
  keywords: string[]
  /** Route path + optional hash fragment (e.g. "/settings#privacy") */
  path: string
  /** Sub-items listed for context in search results */
  sub_items: string[]
}

export const SETTINGS_REGISTRY: SettingsItem[] = [
  {
    id: 'ghost-mode',
    name: 'Ghost Mode',
    description: 'Configure your ghost persona and conversation behavior',
    category: 'Ghost Mode',
    keywords: ['persona', 'alter ego', 'anonymous', 'identity'],
    path: '/settings/ghost#ghost-mode',
    sub_items: ['Enable ghost mode', 'Ghost name', 'Ghost persona'],
  },
  {
    id: 'privacy-analytics',
    name: 'Analytics',
    description: 'Control whether usage data is collected',
    category: 'Privacy',
    keywords: ['tracking', 'telemetry', 'data collection', 'opt out'],
    path: '/settings#privacy',
    sub_items: ['Toggle analytics on/off'],
  },
  // ... 25 total items
]
```

### Search Algorithm

**File**: `src/routes/settings/index.tsx`

```typescript
function searchSettings(query: string): SettingsItem[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return SETTINGS_REGISTRY.filter((item) => {
    const haystack = [
      item.name,
      item.description,
      item.category,
      ...item.sub_items,
      ...item.keywords,
    ].join(' ').toLowerCase()
    return q.split(/\s+/).every((word) => haystack.includes(word))
  })
}
```

**How it works**:
- Concatenates all searchable fields into one string ("haystack")
- Splits query into words
- Every word must appear in the haystack (AND logic)
- Example: `"toggle privacy"` matches items containing both "toggle" AND "privacy"

### Search UI

```typescript
const [searchQuery, setSearchQuery] = useState('')
const [searchFocused, setSearchFocused] = useState(false)
const searchRef = useRef<HTMLDivElement>(null)

const searchResults = useMemo(() => searchSettings(searchQuery), [searchQuery])
const showResults = searchFocused && searchQuery.trim().length > 0
```

**Rendered structure**:

```
┌─ Search Input ────────────────────────────────┐
│ 🔍  Search settings...                     ✕  │
├───────────────────────────────────────────────┤
│ Ghost Mode                        [Ghost Mode] │  ← category badge
│ Configure your ghost persona...                │
│ • Enable ghost mode • Ghost name               │  ← sub_items
├───────────────────────────────────────────────┤
│ Analytics                           [Privacy]  │
│ Control whether usage data is collected         │
│ • Toggle analytics on/off                       │
└───────────────────────────────────────────────┘
```

**Result click handler**:

```typescript
onClick={() => {
  setSearchQuery('')
  setSearchFocused(false)
  const [to, hash] = item.path.split('#')
  navigate({ to, hash })
  if (hash) {
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 300)  // Delay allows DOM to settle after navigation
  }
}
```

### Section Anchors

Each settings section uses an `id` attribute matching the hash fragment:

```typescript
<div id="privacy" className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6">
  <div className="flex items-center gap-3 mb-4">
    <Shield className="w-5 h-5 text-blue-400" />
    <h2 className="text-lg font-semibold text-white">Privacy</h2>
  </div>
  {/* Setting controls */}
</div>
```

### Hash Scroll on Page Load

```typescript
useEffect(() => {
  const hash = window.location.hash.slice(1)
  if (!hash) return
  const timer = setTimeout(() => {
    document.getElementById(hash)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, 300)
  return () => clearTimeout(timer)
}, [])
```

This handles both direct links (`/settings#privacy`) and search-driven navigation.

### Settings Controls Within Sections

**Toggle setting**:

```typescript
<div className="flex items-center justify-between py-3">
  <div>
    <p className="text-sm font-medium text-white">Analytics</p>
    <p className="text-xs text-gray-500">Help improve the app by sharing usage data</p>
  </div>
  <ToggleSwitch
    checked={analyticsEnabled}
    onChange={handleAnalyticsToggle}
    disabled={toggling}
  />
</div>
```

**Slider setting**:

```typescript
<div className="py-3">
  <p className="text-sm font-medium text-white mb-2">Search Relevance</p>
  <p className="text-xs text-gray-500 mb-3">Higher values return fewer but more relevant results</p>
  <Slider min={0} max={0.8} step={0.05} value={threshold} onChange={handleChange} />
</div>
```

**Link to sub-page**:

```typescript
<Link to="/settings/ghost"
  className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-purple-500/50 transition-colors">
  <div className="flex items-center gap-3">
    <Ghost className="w-5 h-5 text-purple-400" />
    <div>
      <p className="text-sm font-medium text-white">Ghost Mode</p>
      <p className="text-xs text-gray-500">Configure persona and trust levels</p>
    </div>
  </div>
  <ChevronRight className="w-4 h-4 text-gray-500" />
</Link>
```

### State Management

**Server-synced preferences** (UIPreferencesContext):
```typescript
const { preferences, updatePreference } = useUIPreferences()

// Optimistic update + API call
const handleToggle = async (value: boolean) => {
  const success = await updatePreference({ memory_card_overflow: value ? 'scroll' : 'clip' })
  if (!success) toast.error({ title: 'Failed to save' })
}
```

**Device-local preferences** (UIPreferencesLocalContext):
```typescript
const { contentFontSize, setContentFontSize } = useUIPreferencesLocal()
// Stored in localStorage, varies per device (mobile vs desktop)
```

---

## Examples

### Adding a New Setting

1. **Add to registry** (`src/constant/settings-registry.ts`):
```typescript
{
  id: 'theme-mode',
  name: 'Theme',
  description: 'Choose light or dark color scheme',
  category: 'Display',
  keywords: ['dark mode', 'light mode', 'appearance', 'color'],
  path: '/settings#ui-preferences',
  sub_items: ['Light', 'Dark', 'System'],
}
```

2. **Add section anchor** (in settings page):
```typescript
<div id="ui-preferences" className="bg-gray-900/50 ...">
  {/* existing controls + new theme toggle */}
</div>
```

3. **Done** — the new setting is immediately searchable.

### Adding a New Sub-Page

1. Create route: `src/routes/settings/new-page.tsx`
2. Add registry entries with `path: '/settings/new-page#section-id'`
3. Add link in main settings page with ChevronRight arrow

---

## Anti-Patterns

### Hardcoding Settings Without Registry

```typescript
// Bad: Settings not searchable, no central definition
<div>
  <h2>Privacy</h2>
  <ToggleSwitch checked={analytics} onChange={toggleAnalytics} />
</div>

// Good: Define in registry, render from section id, searchable automatically
// settings-registry.ts:
{ id: 'privacy-analytics', name: 'Analytics', path: '/settings#privacy', ... }
// settings page:
<div id="privacy">...</div>
```

### OR-Logic Search

```typescript
// Bad: Returns too many results (any word matches)
return q.split(/\s+/).some((word) => haystack.includes(word))

// Good: AND logic — all words must match
return q.split(/\s+/).every((word) => haystack.includes(word))
```

### Scrolling Without Delay

```typescript
// Bad: Element might not be in DOM yet after navigation
document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })

// Good: Wait for DOM to settle
setTimeout(() => {
  document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 300)
```

---

## Key Design Decisions

### Search Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Search data source | Static registry array | Fast, no API call, works offline |
| Search algorithm | AND-logic word matching | More precise than OR; reduces noise |
| Hidden keywords | `keywords[]` field | Improves discoverability without UI clutter |
| Result navigation | Route + hash scroll | Deep-links to exact section |
| Scroll delay | 300ms setTimeout | Allows DOM render after route navigation |

### State Management

| Decision | Choice | Rationale |
|---|---|---|
| Server preferences | UIPreferencesContext with optimistic update | Syncs across devices; instant UI response |
| Device preferences | localStorage via UIPreferencesLocalContext | Font size varies per device (mobile vs desktop) |
| Update pattern | Optimistic + rollback on failure | Feels instant; reverts if API fails |

---

## Checklist

- [ ] New settings added to `SETTINGS_REGISTRY` with id, name, description, category, keywords, path, sub_items
- [ ] Section div has `id` attribute matching the hash fragment in the registry path
- [ ] Keywords include synonyms users might search for (e.g., "telemetry" for analytics)
- [ ] Sub-items list the specific controls within the section
- [ ] Path uses hash fragment for same-page sections, full route for sub-pages
- [ ] Settings controls use ToggleSwitch, Slider, or link-with-chevron patterns
- [ ] Server-synced settings use optimistic update via UIPreferencesContext
- [ ] Device-local settings use localStorage via UIPreferencesLocalContext

---

## Related Patterns

- **[Form Controls](./tanstack-cloudflare.form-controls.md)**: ToggleSwitch and Slider used within settings sections
- **[Unified Header](./tanstack-cloudflare.unified-header.md)**: Settings page uses UnifiedHeader with back navigation

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
