# Markdown Content Rendering

**Category**: Design
**Applicable To**: Rendering AI-generated or user-submitted markdown with XSS protection, @mention badges, code blocks, and font size preferences
**Status**: Stable

---

## Overview

`MarkdownContent` wraps ReactMarkdown with rehype-sanitize for XSS protection, custom mention preprocessing (`@agent`, `@uid:userId`), link validation (internal/external routing), syntax-highlighted code blocks, and user font size preferences. Safe for rendering AI-generated content that may contain arbitrary markdown.

---

## Implementation

**File**: `src/components/chat/MarkdownContent.tsx`

```typescript
interface MarkdownContentProps {
  content: string
  className?: string
  currentUserId?: string  // For mention badge interactivity
}
```

### Processing Pipeline

```
Raw content
  → stripTimestampPrefix()     // Remove <msg ts="..."/> prefixes
  → linkifyText()              // Convert bare URLs to [url](url) markdown
  → preprocessMentions()       // @agent → **@agent**, @uid:X → **@uid:X**
  → ReactMarkdown
      + rehype-sanitize        // Strip XSS vectors
      + custom components      // Links, code, strong (mentions)
```

### XSS Sanitization

```typescript
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    a: ['href', 'title'],
  },
  protocols: { href: ['http', 'https', 'mailto'] },
  tagNames: (defaultSchema.tagNames || []).filter(tag =>
    !['script', 'iframe', 'object', 'embed', 'style'].includes(tag)
  ),
}
```

### Link Routing

```typescript
// Internal links (/memory/abc): navigate within app
// External links (https://...): target="_blank" rel="noopener noreferrer"
// Invalid URLs: render as red [Invalid Link] span

function isInternalUrl(url: string): boolean { return url.startsWith('/') }
function isValidUrl(url: string): boolean {
  if (url.startsWith('/')) return true
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol) }
  catch { return false }
}
```

### Code Blocks

```typescript
// Multiline → CodeBlock component with syntax highlighting + copy button
// Inline → gray background with font size preference
const isCodeBlock = code.includes('\n') || startLine !== endLine
if (isCodeBlock) return <CodeBlock code={code} language={language} />
return <code className="bg-gray-700 px-1.5 py-0.5 rounded">{children}</code>
```

### Mention Badges

`@agent` and `@uid:userId` are preprocessed to bold markdown, then the `strong` renderer detects them:

```typescript
strong({ children }) {
  const text = extractText(children)
  if (text === '@agent') return <span className="bg-blue-500/20 text-blue-400 ...">@agent</span>
  if (text.startsWith('@uid:')) return <MentionBadge userId={text.slice(5)} />
  return <strong>{children}</strong>
}
```

### Font Size Integration

Uses `useUIPreferencesLocal()` context — heading sizes and prose classes scale with preference.

---

## Anti-Patterns

### Rendering Unsanitized HTML

```typescript
// Bad: XSS vulnerability
<div dangerouslySetInnerHTML={{ __html: aiResponse }} />

// Good: ReactMarkdown + rehype-sanitize
<MarkdownContent content={aiResponse} />
```

---

**Status**: Stable
**Last Updated**: 2026-03-14
**Contributors**: Community
