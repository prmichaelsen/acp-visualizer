# Mention Suggestion System

**Category**: Design
**Applicable To**: @mention autocomplete in chat inputs with instant context + async search tiers
**Status**: Stable

---

## Overview

A two-tier mention autocomplete: Tier 1 (instant) uses in-memory conversation participant profiles for sub-millisecond results. Tier 2 (async) searches the global people index via API when the context tier has no matches. Stale call detection prevents race conditions. Suggestions sorted by: agent first → prefix matches → substring matches.

---

## Implementation

### useMentionSuggestions Hook

**File**: `src/hooks/useMentionSuggestions.ts`

```typescript
interface MentionSuggestion {
  id: string                    // userId or 'agent'
  username: string
  type: 'agent' | 'user'
  avatarUrl?: string
  displayName?: string
  section?: 'context' | 'search'
}

function useMentionSuggestions(participantIds?: string[]) {
  const contextProfilesRef = useRef<Map<string, UserProfile>>(new Map())
  const callIdRef = useRef(0)  // Stale call detection

  // Tier 1: Load participant profiles on mount
  useEffect(() => {
    if (!participantIds?.length) return
    ProfileService.getProfiles(participantIds).then(profiles => {
      contextProfilesRef.current = new Map(Object.entries(profiles))
    })
  }, [participantIds?.join(',')])

  const getSuggestions = useCallback(async (query: string) => {
    const thisCallId = ++callIdRef.current

    // Tier 1: Instant context matches
    const contextResults = matchFromContext(query, contextProfilesRef.current)

    // Tier 2: Async global search (if context insufficient)
    if (contextResults.length < 3 && query.length >= 1) {
      const searchResults = await PeopleService.search(query, 5)
      if (callIdRef.current !== thisCallId) return []  // Stale
      return [...contextResults, ...searchResults]
    }

    return contextResults
  }, [])

  return { getSuggestions }
}
```

### MentionAutocomplete Component

**File**: `src/components/chat/MentionAutocomplete.tsx`

```typescript
interface MentionAutocompleteProps {
  inputValue: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onSelect: (suggestion, startIndex, endIndex) => void
  getSuggestions?: (query: string) => MentionSuggestion[] | Promise<MentionSuggestion[]>
  maxResults?: number
  reverse?: boolean  // Bottom-to-top rendering (closest to input = most relevant)
}
```

**Mention Detection**: Scans backwards from cursor for `@` preceded by whitespace or start-of-input.

**Keyboard Navigation**: ArrowUp/Down (flipped in reverse mode), Enter/Tab to select, Escape to close.

**Text Insertion**: `onSelect(suggestion, @position, endPosition)` — caller replaces the `@query` range with `@username `.

---

## Checklist

- [ ] Tier 1 profiles loaded from conversation participants on mount
- [ ] Tier 2 search triggered when context has < 3 matches
- [ ] Stale call detection via incrementing callIdRef
- [ ] Agent suggestion always appears first if query matches
- [ ] `reverse` mode used when autocomplete renders above input

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
