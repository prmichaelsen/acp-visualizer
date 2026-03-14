# Global Search Context

**Category**: Architecture
**Applicable To**: Cross-component state sharing without Redux — search queries, filters, or any key-scoped shared state
**Status**: Stable

---

## Overview

A lightweight pub/sub mechanism using React Context + `useRef` that enables multiple components to share state by key without Redux. Components call `useGlobalSearch(key)` and get a `[value, setValue]` tuple. Setting a value notifies only subscribers of that key, avoiding unnecessary renders for unrelated keys.

---

## Implementation

**File**: `src/contexts/GlobalSearchContext.tsx`

```typescript
interface Store {
  values: Map<string, string>
  subscribers: Map<string, Set<() => void>>
}

const GlobalSearchContext = createContext<Store>(/* ... */)

function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Store>({
    values: new Map(),
    subscribers: new Map(),
  })
  return (
    <GlobalSearchContext.Provider value={storeRef.current}>
      {children}
    </GlobalSearchContext.Provider>
  )
}

function useGlobalSearch(key: string): [string, (value: string) => void] {
  const store = useContext(GlobalSearchContext)
  const [, setTick] = useState(0)  // Force re-render

  useEffect(() => {
    const bump = () => setTick(t => t + 1)
    if (!store.subscribers.has(key)) store.subscribers.set(key, new Set())
    store.subscribers.get(key)!.add(bump)
    return () => { store.subscribers.get(key)?.delete(bump) }
  }, [store, key])

  const value = store.values.get(key) ?? ''

  const setValue = useCallback((v: string) => {
    const current = store.values.get(key) ?? ''
    if (current === v) return  // Skip if unchanged
    if (v) store.values.set(key, v)
    else store.values.delete(key)
    store.subscribers.get(key)?.forEach(fn => fn())
  }, [store, key])

  return [value, setValue]
}
```

**Usage**:

```typescript
// Component A (search input)
const [query, setQuery] = useGlobalSearch('memories:query')
<input value={query} onChange={e => setQuery(e.target.value)} />

// Component B (feed list) — subscribes to same key
const [query] = useGlobalSearch('memories:query')
// Re-renders only when memories:query changes

// Component C (different key) — NOT re-rendered
const [filter] = useGlobalSearch('conversations:filter')
```

**Key conventions**: `{page}:{field}` (e.g., `memories:query`, `conversations:filter`, `messages:query`)

---

## Checklist

- [ ] Wrap app in `<GlobalSearchProvider>` (in root layout)
- [ ] Use key convention `{page}:{field}` for scope isolation
- [ ] Don't use for non-search state — this is optimized for string values

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
