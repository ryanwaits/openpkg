# Inline Code

Syntax-highlighted inline code snippets.

## Import

```typescript
// Server component
import { DocsKitInlineCode } from '@doccov/ui/docskit';

// Client component
import { ClientInlineCode } from '@doccov/ui/docskit';
```

## Basic Usage

```tsx
<p>
  Use the{' '}
  <DocsKitInlineCode codeblock={{ value: 'useState', lang: 'typescript', meta: '' }} />{' '}
  hook to manage state.
</p>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `codeblock` | `RawCode` | Code content and language |

### RawCode Object

| Field | Type | Description |
|-------|------|-------------|
| `value` | `string` | The code content |
| `lang` | `string` | Language for highlighting |
| `meta` | `string` | Usually empty for inline code |

## Multiple Inline Codes

```tsx
<p>
  Use{' '}
  <DocsKitInlineCode codeblock={{ value: 'useState', lang: 'typescript', meta: '' }} />{' '}
  for state and{' '}
  <DocsKitInlineCode codeblock={{ value: 'useEffect', lang: 'typescript', meta: '' }} />{' '}
  for side effects.
</p>
```

## Styling

Inline code renders with:
- Rounded border
- Subtle background color
- No line wrapping (`whitespace-nowrap`)
- Monospace font

CSS variables:
```css
--dk-background: /* background color */
--dk-border: /* border color */
--dk-selection: /* text selection */
```

## Server vs Client

| Component | Use Case |
|-----------|----------|
| `DocsKitInlineCode` | Server-rendered, few inline codes |
| `ClientInlineCode` | Many inline codes, client components |

## When to Use

| Use Case | Component |
|----------|-----------|
| Simple inline code (no highlighting needed) | Regular `<code>` |
| Syntax-highlighted inline code | `DocsKitInlineCode` |
| Code blocks | `DocsKitCode` |

## See Also

- [Code Blocks](./code-blocks.md) - Block-level code
- [Client Components](./client-components.md) - Client-side variants
