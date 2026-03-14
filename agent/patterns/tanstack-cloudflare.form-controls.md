# Form Controls: Slider & ToggleSwitch

**Category**: Design
**Applicable To**: Range inputs and boolean toggles
**Status**: Stable

---

## Overview

Two reusable form control components: Slider (continuous/discrete range input with gradient fill) and ToggleSwitch (iOS-style boolean toggle with ARIA support). Both follow consistent dark theme styling and are fully keyboard accessible. For pagination controls (Paginator, PaginationToggle, InfiniteScrollSentinel, Virtuoso), see [Pagination Suite](./tanstack-cloudflare.pagination.md).

---

## Implementation

### Slider

**File**: `src/components/Slider.tsx`

```typescript
// Continuous mode
interface SliderContinuousProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}

// Discrete mode
interface SliderDiscreteProps {
  options: Array<{ value: number; label?: string }>
  value: number
  onChange: (value: number) => void
}
```

**Features**:
- **Continuous**: Standard min/max/step range input
- **Discrete**: Snaps to predefined option values, optional labels below
- **Gradient fill**: `linear-gradient(90deg, #3b82f6 0%, #8b5cf6 ${pct}%, rgb(55 65 81) ${pct}%)`
- Custom CSS class `slider-styled` in `styles.css`:
  - Thumb: 20px circle, box-shadow, -7px margin-top
  - Track: 6px height, 3px border-radius
- Keyboard: Left/Right arrows adjust value

**Usage**:
```typescript
<Slider min={0} max={100} step={5} value={volume} onChange={setVolume} />

<Slider
  options={[
    { value: 0, label: 'Off' },
    { value: 50, label: 'Medium' },
    { value: 100, label: 'Max' },
  ]}
  value={level}
  onChange={setLevel}
/>
```

---

### ToggleSwitch

**File**: `src/components/ToggleSwitch.tsx`

```typescript
interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: 'sm' | 'md' | 'lg'  // default: 'md'
  label?: string
  description?: string
  disabled?: boolean
  id?: string
}
```

**Features**:
- iOS-style toggle with animated knob
- **Checked**: gradient background `from-purple-600 to-blue-600`, checkmark inside knob
- **Unchecked**: `bg-gray-700`, plain knob
- Size presets (md: track w-11 h-6, knob w-5 h-5)
- Keyboard: Space/Enter toggles
- `role="switch"`, `aria-checked` for accessibility
- `focus-visible:ring-2 ring-purple-500` focus ring
- Optional label + description text
- Disabled: `opacity-50 cursor-not-allowed`

**Usage**:
```typescript
<ToggleSwitch
  checked={darkMode}
  onChange={setDarkMode}
  label="Dark Mode"
  description="Use dark color scheme throughout the app"
/>
```

---

## Anti-Patterns

### Using Native Checkbox Instead of ToggleSwitch

```typescript
// Bad: Inconsistent with app design
<input type="checkbox" checked={value} onChange={...} />

// Good: Use ToggleSwitch for visual consistency
<ToggleSwitch checked={value} onChange={setValue} label="Enable feature" />
```

### Inline Range Input Instead of Slider

```typescript
// Bad: No gradient fill, no discrete mode support
<input type="range" min={0} max={100} />

// Good: Use Slider with gradient and optional discrete options
<Slider min={0} max={100} step={1} value={val} onChange={setVal} />
```

---

## Checklist

- [ ] Use `Slider` for any range/value selection (not raw `<input type="range">`)
- [ ] Use `ToggleSwitch` for boolean settings (not checkboxes)
- [ ] ToggleSwitch has `role="switch"` and `aria-checked`
- [ ] All controls are keyboard accessible

---

## Related Patterns

- **[Pagination Suite](./tanstack-cloudflare.pagination.md)**: Paginator, PaginationToggle, InfiniteScrollSentinel, Virtuoso patterns

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
