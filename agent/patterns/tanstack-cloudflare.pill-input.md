# PillInput & Multi-Typeahead Selector

**Category**: Design
**Applicable To**: Multi-value inputs with typeahead suggestions, tag selection, and filterable option lists
**Status**: Stable

---

## Overview

PillInput is a multi-value text input with Fuse.js fuzzy typeahead, removable pill badges, custom entry support, and keyboard navigation. It supports both selecting from a predefined options list and entering custom free-text values. Used for tag filters, space selectors, and multi-value search inputs.

---

## Implementation

### PillInput

**File**: `src/components/feed/PillInput.tsx`

```typescript
interface PillInputProps {
  options: string[]            // Available options for typeahead
  selected: string[]           // Currently selected values
  onChange: (selected: string[]) => void
  placeholder?: string
  allowCustom?: boolean        // Allow free-text entries (default: true)
  maxResults?: number          // Max suggestions shown (default: 8)
}
```

**Features**:

1. **Typeahead with Fuse.js** (threshold: 0.4):
   - Filters options list as user types
   - Removes already-selected values from suggestions
   - Shows up to `maxResults` matches

2. **Custom Entry** (when `allowCustom: true`):
   - Enter or comma adds current text as custom pill
   - Trims whitespace, prevents duplicates

3. **Keyboard Navigation**:
   - ArrowUp/ArrowDown: navigate dropdown suggestions
   - Enter: select highlighted suggestion (or add custom)
   - Escape: close dropdown
   - Backspace on empty input: remove last pill

4. **Pill Display**:
   - Gradient background: `from-purple-500 to-blue-500`
   - X button to remove individual pills
   - Flex wrap layout for multiple pills

5. **Dropdown**:
   - Positioned below input
   - Max 8 results
   - Highlighted item via keyboard or hover
   - Click outside closes dropdown

**Usage**:

```typescript
const [tags, setTags] = useState<string[]>([])

<PillInput
  options={['javascript', 'typescript', 'python', 'rust', 'go']}
  selected={tags}
  onChange={setTags}
  placeholder="Add tags..."
  allowCustom={true}
/>
```

**Rendered Output**:

```
┌─────────────────────────────────────────────┐
│ [javascript ×] [rust ×]  type here...       │
├─────────────────────────────────────────────┤
│ ▸ typescript                                │
│   python                                    │
│   go                                        │
└─────────────────────────────────────────────┘
```

---

### Multi-Typeahead Pattern (Generalized)

For more complex multi-select scenarios beyond string arrays, use this generalized approach:

```typescript
interface TypeaheadOption<T> {
  id: string
  label: string
  data: T
}

function useMultiTypeahead<T>(options: TypeaheadOption<T>[], selected: string[]) {
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const fuse = useMemo(() => new Fuse(options, {
    keys: ['label'],
    threshold: 0.4,
  }), [options])

  const suggestions = useMemo(() => {
    const base = query
      ? fuse.search(query).map(r => r.item)
      : options
    return base
      .filter(opt => !selected.includes(opt.id))
      .slice(0, 8)
  }, [query, selected, fuse, options])

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(i => Math.min(suggestions.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(i => Math.max(0, i - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightIndex >= 0) selectOption(suggestions[highlightIndex])
        break
      case 'Escape':
        setQuery('')
        break
      case 'Backspace':
        if (!query && selected.length) removeLastSelected()
        break
    }
  }

  return { query, setQuery, suggestions, highlightIndex, handleKeyDown }
}
```

**Usage with complex objects**:

```typescript
const { query, setQuery, suggestions, highlightIndex, handleKeyDown } = useMultiTypeahead(
  users.map(u => ({ id: u.uid, label: u.displayName, data: u })),
  selectedUserIds
)

<input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown} />
{suggestions.map((opt, i) => (
  <div key={opt.id}
    className={i === highlightIndex ? 'bg-gray-700' : ''}
    onClick={() => addSelection(opt.id)}>
    <Avatar user={opt.data} />
    <span>{opt.label}</span>
  </div>
))}
```

---

## Anti-Patterns

### Using Select/Multiselect Instead of PillInput

```typescript
// Bad: Native multi-select is ugly and hard to use on mobile
<select multiple>{options.map(o => <option>{o}</option>)}</select>

// Good: PillInput with typeahead for better UX
<PillInput options={options} selected={selected} onChange={setSelected} />
```

### Not Filtering Already-Selected Options

```typescript
// Bad: User sees already-selected items in dropdown (confusing)
const suggestions = fuse.search(query)

// Good: Remove selected from suggestions
const suggestions = fuse.search(query).filter(r => !selected.includes(r.item))
```

### Forgetting Backspace-to-Remove

```typescript
// Bad: No way to remove last pill from keyboard
onKeyDown={(e) => { if (e.key === 'Enter') addPill() }}

// Good: Backspace on empty input removes last pill
onKeyDown={(e) => {
  if (e.key === 'Backspace' && !query && selected.length) {
    removeLastPill()
  }
}
```

---

## Checklist

- [ ] Use Fuse.js for fuzzy matching (threshold: 0.4)
- [ ] Filter already-selected values from suggestions
- [ ] Support ArrowUp/Down for dropdown navigation
- [ ] Support Enter to select highlighted or add custom
- [ ] Support Backspace on empty to remove last pill
- [ ] Support Escape to close dropdown
- [ ] Click outside closes dropdown
- [ ] Max 8 results in dropdown to prevent overwhelming
- [ ] Pills show gradient background with X remove button
- [ ] Trim whitespace and prevent duplicate entries

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
