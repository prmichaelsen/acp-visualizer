# Task 11: Install Markdown Dependencies & Build MarkdownContent Component

**Milestone**: [M3 - Detail Views](../../milestones/milestone-3-detail-views.md)
**Design Reference**: [Milestone & Task Detail Views](../../design/local.milestone-task-detail-views.md)
**Estimated Time**: 2 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Install markdown rendering dependencies and create a reusable `MarkdownContent` component that renders markdown strings with syntax-highlighted code blocks and dark-theme-consistent typography.

---

## Context

The visualizer currently has no markdown rendering capability. Detail pages will need to display the full content of ACP task and milestone documents, which contain headings, lists, code blocks (bash, TypeScript, YAML, JSON), tables, and inline formatting. The component must integrate with the existing dark theme (gray-950 background, gray-100 text).

---

## Steps

### 1. Install Dependencies

```bash
npm install react-markdown rehype-highlight @tailwindcss/typography
```

- **react-markdown** (^9.x): React component for rendering markdown
- **rehype-highlight** (^7.x): rehype plugin for syntax highlighting code blocks via highlight.js
- **@tailwindcss/typography**: Tailwind plugin providing `prose` classes for rich text styling

### 2. Configure Tailwind Typography Plugin

Add the typography plugin to the Tailwind config. Import a highlight.js dark theme CSS (e.g., `github-dark` or `atom-one-dark`) in the app's global styles.

### 3. Create MarkdownContent Component

Create `src/components/MarkdownContent.tsx`:

```typescript
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      className={`prose prose-invert prose-sm max-w-none ${className ?? ''}`}
    >
      {content}
    </ReactMarkdown>
  );
}
```

Key styling decisions:
- `prose-invert` for dark theme compatibility
- `prose-sm` for compact information density matching the dashboard
- `max-w-none` to use full available width
- Custom overrides for code block backgrounds to match gray-900/gray-800 palette

### 4. Style Overrides

Add Tailwind prose overrides so that:
- Code block backgrounds use `bg-gray-900` (matching the dashboard)
- Inline code uses `bg-gray-800` with slightly lighter text
- Links use the blue accent color from the existing design tokens
- Table styling matches the dashboard's table components
- Headings use the same font weights as the dashboard

### 5. Test with Sample Markdown

Create a simple test route or storybook-style preview that renders a sample markdown string containing:
- H1, H2, H3 headings
- Bullet and numbered lists
- Code blocks (TypeScript, bash, YAML, JSON)
- Inline code
- Tables
- Bold/italic text
- Links

Verify rendering is correct and visually consistent with the dashboard theme.

---

## Verification

- [ ] `react-markdown`, `rehype-highlight`, `@tailwindcss/typography` installed in package.json
- [ ] Tailwind typography plugin configured
- [ ] Highlight.js dark theme CSS imported
- [ ] `MarkdownContent` component exists at `src/components/MarkdownContent.tsx`
- [ ] Component renders headings (H1-H6) correctly
- [ ] Component renders code blocks with syntax highlighting
- [ ] Component renders tables, lists, links, inline code
- [ ] Dark theme styling is consistent (prose-invert, matching backgrounds)
- [ ] No build errors when running `npm run dev`

---

## Expected Output

**Files Created**:
- `src/components/MarkdownContent.tsx` — Reusable markdown rendering component

**Files Modified**:
- `package.json` — New dependencies added
- Tailwind config / global CSS — Typography plugin and highlight.js theme

---

## Key Design Decisions

### Rendering

| Decision | Choice | Rationale |
|---|---|---|
| Markdown library | react-markdown | Most popular React solution, good plugin ecosystem |
| Syntax highlighting | rehype-highlight | Integrates cleanly with react-markdown's rehype pipeline |
| Theme | prose-invert with custom overrides | Consistent with existing gray-950 dark dashboard theme |

---

**Next Task**: [Task 12: Build Markdown Loading Service](task-12-markdown-loading-service.md)
**Related Design Docs**: [local.milestone-task-detail-views.md](../../design/local.milestone-task-detail-views.md)
