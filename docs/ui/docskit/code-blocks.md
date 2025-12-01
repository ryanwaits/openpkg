# Code Blocks

Syntax-highlighted code blocks with optional titles, copy buttons, line numbers, and annotations.

## Import

```typescript
// Server component (SSR)
import { DocsKitCode } from '@doccov/ui/docskit';

// Client component (no SSR, lazy highlighting)
import { ClientDocsKitCode } from '@doccov/ui/docskit';
```

## Basic Usage

```tsx
<DocsKitCode
  codeblock={{
    value: `const greeting = "Hello, World!";`,
    lang: 'typescript',
    meta: '',
  }}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `codeblock` | `RawCode` | Code content, language, and metadata |
| `handlers` | `AnnotationHandler[]` | Optional custom annotation handlers |

### RawCode Object

| Field | Type | Description |
|-------|------|-------------|
| `value` | `string` | The code content |
| `lang` | `string` | Language for syntax highlighting (e.g., `typescript`, `bash`, `json`) |
| `meta` | `string` | Metadata string with title and flags |

## Metadata Flags

Flags are passed in the `meta` string, prefixed with `-`:

| Flag | Description |
|------|-------------|
| `-c` | Show copy button |
| `-n` | Show line numbers |
| `-w` | Enable word wrap |
| `-a` | Enable animations (token transitions) |

Flags can be combined: `-cn` for copy button + line numbers.

## With Title

The filename or title comes before the flags in the meta string:

```tsx
<DocsKitCode
  codeblock={{
    value: `export function greet(name: string) {
  return \`Hello, \${name}!\`;
}`,
    lang: 'typescript',
    meta: 'greet.ts -c',  // title: "greet.ts", copy button enabled
  }}
/>
```

## With Line Numbers

```tsx
<DocsKitCode
  codeblock={{
    value: exampleCode,
    lang: 'typescript',
    meta: 'useCounter.ts -cn',  // copy button + line numbers
  }}
/>
```

## Without Title

Omit the title for a minimal code block:

```tsx
<DocsKitCode
  codeblock={{
    value: `const x = 1;`,
    lang: 'typescript',
    meta: '-c',  // just copy button, no title
  }}
/>
```

## Supported Languages

Any language supported by Shiki/TextMate grammars:

- `typescript`, `tsx`, `javascript`, `jsx`
- `python`, `ruby`, `go`, `rust`, `java`
- `bash`, `shell`, `zsh`
- `json`, `yaml`, `toml`
- `css`, `scss`, `html`
- `sql`, `graphql`
- `markdown`, `mdx`
- And many more...

## Server vs Client Components

| Component | Use Case |
|-----------|----------|
| `DocsKitCode` | Server-rendered pages, MDX, few code blocks per page |
| `ClientDocsKitCode` | Many code blocks, lazy loading, client components |

The client version highlights code in `useEffect` to avoid SSR memory issues when rendering many blocks.

## Styling

Code blocks use CSS custom properties:

```css
--dk-background: /* code background */
--dk-border: /* border color */
--dk-tabs-background: /* title bar background */
--dk-tab-inactive-foreground: /* title text color */
--dk-selection: /* text selection highlight */
```

## See Also

- [Annotations](./annotations.md) - Add marks, diffs, highlights
- [Code Tabs](./code-tabs.md) - Multi-file code blocks
- [Terminal](./terminal.md) - Terminal-style blocks
- [Client Components](./client-components.md) - Client-side variants
