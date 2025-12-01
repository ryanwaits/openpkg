# Client Components

Client-side variants of DocsKit components that perform syntax highlighting in the browser instead of during SSR.

## Why Client Components?

Server components (`DocsKitCode`, `Terminal`, etc.) highlight code during server-side rendering. This works well for pages with a few code blocks, but can cause **Node.js out-of-memory errors** when rendering many blocks (20+) because:

- Each `highlight()` call loads language grammars into memory
- Many concurrent highlights exhaust the Node.js heap

Client components solve this by:
- Rendering a skeleton placeholder during SSR
- Highlighting code in `useEffect` on the client
- Each component manages its own loading state

## Available Components

| Server Component | Client Component |
|------------------|------------------|
| `DocsKitCode` | `ClientDocsKitCode` |
| `Terminal` | `ClientTerminal` |
| `DocsKitInlineCode` | `ClientInlineCode` |
| `Code` | `ClientCode` |

## Import

```typescript
import {
  ClientDocsKitCode,
  ClientTerminal,
  ClientInlineCode,
  ClientCode,
} from '@doccov/ui/docskit';
```

## Usage

Client components have the **same API** as their server counterparts:

```tsx
// Server version
<DocsKitCode
  codeblock={{ value: code, lang: 'typescript', meta: 'file.ts -c' }}
/>

// Client version (identical API)
<ClientDocsKitCode
  codeblock={{ value: code, lang: 'typescript', meta: 'file.ts -c' }}
/>
```

## When to Use

| Scenario | Recommendation |
|----------|----------------|
| MDX docs with few code blocks | Server components |
| Pages with 20+ code blocks | Client components |
| Code behind accordions/tabs | Client components (lazy highlight) |
| Demo/showcase pages | Client components |
| Already in a client component | Client components |

## Loading States

Client components show animated skeleton placeholders while highlighting:

```tsx
// Skeleton shown until highlight() completes
<ClientDocsKitCode codeblock={...} />
```

Skeletons match the visual structure of the final component (title bar, code lines, etc.).

## Dynamic Import Pattern

For pages with many code blocks, use dynamic import with `ssr: false`:

```tsx
'use client';

import dynamic from 'next/dynamic';

const Showcase = dynamic(
  () => import('./showcase').then(mod => mod.Showcase),
  { ssr: false, loading: () => <ShowcaseSkeleton /> }
);
```

This prevents the showcase from running during SSR entirely.

## Features Supported

All features work the same as server components:

- All annotation types (`!mark`, `!diff`, `!collapse`, etc.)
- Flags (`-c`, `-n`, `-w`)
- Titles and file icons
- Copy buttons
- Code tabs

## Performance Notes

- Highlighting happens in parallel for visible components
- Each component highlights independently
- Uses cancellation to prevent stale state updates
- Memoizes on `value + lang + meta` to avoid re-highlighting

## See Also

- [Code Blocks](./code-blocks.md) - Server component reference
- [Skeletons](./skeletons.md) - Loading state components
- [Annotations](./annotations.md) - Code annotations
