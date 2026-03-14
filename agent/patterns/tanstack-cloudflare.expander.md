# Expander Component

**Category**: Design
**Applicable To**: Expandable/collapsible sections with smooth height animation and 10 visual variants
**Status**: Stable

---

## Overview

A polymorphic expandable section component with 10 distinct visual variants (gradient-glow, neon-accent, glass-float, slide-arrow, border-sweep, stacked-lift, visibility, thread, highlight, segmented). Uses a `useCollapse` hook for CSS-transition-based height animation (300ms cubic-bezier). Controlled open/close state with consistent API across all variants.

---

## Implementation

**File**: `src/components/Expander.tsx`

```typescript
interface ExpanderProps {
  title: string
  count?: number           // Optional count badge (border-sweep variant)
  open: boolean            // Controlled state
  onToggle: () => void
  children: ReactNode
}

function Expander({ variant = 'gradient-glow', ...props }: ExpanderProps & { variant?: ExpanderVariant })
```

### useCollapse Hook (Height Animation)

```typescript
function useCollapse(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(open ? undefined : 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open) {
      setHeight(el.scrollHeight)
      const id = setTimeout(() => setHeight(undefined), 300)  // Auto after animation
      return () => clearTimeout(id)
    } else {
      setHeight(el.scrollHeight)
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)))
    }
  }, [open])

  return {
    ref,
    style: {
      height: height != null ? `${height}px` : 'auto',
      overflow: 'hidden' as const,
      transition: 'height 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
  }
}
```

### Variants

| Variant | Visual |
|---|---|
| `gradient-glow` | Blue text title with chevron, minimal |
| `neon-accent` | Left green border (glows on open), plus/minus icon |
| `glass-float` | Frosted glass blur effect when open, sparkle icon |
| `slide-arrow` | Arrow rotates 90° on open, indented content |
| `border-sweep` | Bottom amber gradient border sweeps in, count badge |
| `stacked-lift` | Layered border effects above title when open |
| `visibility` | iOS-style toggle switch, eye/eye-off icon |
| `thread` | Gradient vertical line with nested indentation |
| `highlight` | Indigo ring + background highlight, zap icon with scale |
| `segmented` | 3 animated dots (staggered timing), fuchsia color |

Exported as `EXPANDER_VARIANTS: Array<{ id: string; label: string }>`.

**Usage**:

```typescript
const [open, setOpen] = useState(false)

<Expander
  variant="glass-float"
  title="Advanced Settings"
  open={open}
  onToggle={() => setOpen(!open)}
>
  <p>Expanded content here</p>
</Expander>
```

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
