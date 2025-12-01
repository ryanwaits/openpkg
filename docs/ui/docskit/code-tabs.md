# Code Tabs

Display multiple code files in a tabbed interface.

## Import

```typescript
// Server component
import { Code } from '@doccov/ui/docskit';

// Client component
import { ClientCode } from '@doccov/ui/docskit';
```

## Basic Usage

```tsx
<Code
  codeblocks={[
    {
      value: `import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}`,
      lang: 'tsx',
      meta: 'Counter.tsx -c',
    },
    {
      value: `.counter {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
}`,
      lang: 'css',
      meta: 'counter.css -c',
    },
    {
      value: `{
  "name": "counter-component",
  "version": "1.0.0"
}`,
      lang: 'json',
      meta: 'package.json -c',
    },
  ]}
  flags="-c"
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `codeblocks` | `RawCode[]` | Array of code blocks |
| `flags` | `string` | Default flags for all tabs |
| `storage` | `string` | localStorage key for remembering selected tab |

## Single Tab Behavior

If only one codeblock is provided, it renders as a single code block without tabs (same as `DocsKitCode`).

## Tab Titles

Tab titles come from the `meta` string of each codeblock:

```tsx
{
  value: '...',
  lang: 'typescript',
  meta: 'utils.ts -c',  // "utils.ts" becomes the tab title
}
```

## Flags

Flags can be set per-tab or globally:

```tsx
<Code
  codeblocks={[
    { value: '...', lang: 'ts', meta: 'index.ts -cn' },    // copy + line numbers
    { value: '...', lang: 'css', meta: 'styles.css -c' },  // copy only
  ]}
  flags="-c"  // default for tabs without flags
/>
```

## Persistent Selection

Use `storage` to remember the selected tab:

```tsx
<Code
  codeblocks={[...]}
  storage="example-language"
/>
```

All `Code` components with the same `storage` key will sync their selection.

## Server vs Client

| Component | Use Case |
|-----------|----------|
| `Code` | Server-rendered pages, few tabbed blocks |
| `ClientCode` | Many tabbed blocks, client components |

## Icons

Tab icons are automatically determined by file extension:
- `.ts`, `.tsx` → TypeScript icon
- `.js`, `.jsx` → JavaScript icon
- `.css` → CSS icon
- `.json` → JSON icon
- etc.

## See Also

- [Code Blocks](./code-blocks.md) - Single code blocks
- [Terminal](./terminal.md) - Terminal commands
- [Client Components](./client-components.md) - Client-side variants
