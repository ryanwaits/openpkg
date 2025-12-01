# Skeleton Components

Loading state components that match the visual structure of DocsKit components.

## Import

```typescript
import {
  CodeBlockSkeleton,
  TerminalSkeleton,
  InlineCodeSkeleton,
  CodeTabsSkeleton,
} from '@doccov/ui/docskit';
```

## CodeBlockSkeleton

Placeholder for `DocsKitCode` / `ClientDocsKitCode`:

```tsx
<CodeBlockSkeleton hasTitle={true} lines={6} />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `hasTitle` | `boolean` | `true` | Show title bar skeleton |
| `lines` | `number` | `6` | Number of code line skeletons |

## TerminalSkeleton

Placeholder for `Terminal` / `ClientTerminal`:

```tsx
<TerminalSkeleton lines={3} />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lines` | `number` | `3` | Number of command line skeletons |

Includes macOS-style window dots in the header.

## InlineCodeSkeleton

Placeholder for `DocsKitInlineCode` / `ClientInlineCode`:

```tsx
<p>
  Use the <InlineCodeSkeleton /> hook to manage state.
</p>
```

Renders as a small inline animated placeholder.

## CodeTabsSkeleton

Placeholder for `Code` / `ClientCode` (tabbed):

```tsx
<CodeTabsSkeleton tabs={3} lines={6} />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabs` | `number` | `2` | Number of tab skeletons |
| `lines` | `number` | `6` | Number of code line skeletons |

## Usage with Dynamic Import

```tsx
'use client';

import dynamic from 'next/dynamic';
import { CodeBlockSkeleton, TerminalSkeleton } from '@doccov/ui/docskit';

const Showcase = dynamic(
  () => import('./showcase'),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <TerminalSkeleton lines={1} />
        <CodeBlockSkeleton hasTitle lines={10} />
        <CodeBlockSkeleton hasTitle={false} lines={3} />
      </div>
    ),
  }
);
```

## Animation

All skeletons use a subtle pulse animation:

```css
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

## Styling

Skeletons use the same CSS variables as DocsKit components:

```css
--dk-background: /* skeleton background */
--dk-border: /* border color */
--dk-tabs-background: /* header background */
```

Skeleton lines use varying widths (40%-80%) for a natural appearance.

## See Also

- [Client Components](./client-components.md) - Components that use skeletons
- [Code Blocks](./code-blocks.md) - The components these skeleton for
