# Terminal

macOS-style terminal blocks with window controls (traffic light dots).

## Import

```typescript
// Server component
import { Terminal } from '@doccov/ui/docskit';

// Client component
import { ClientTerminal } from '@doccov/ui/docskit';
```

## Basic Usage

```tsx
<Terminal
  codeblock={{
    value: 'npm install @doccov/ui',
    lang: 'bash',
    meta: '-c',
  }}
/>
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `codeblock` | `RawCode` | Command content and metadata |
| `handlers` | `AnnotationHandler[]` | Optional custom annotation handlers |

## Flags

| Flag | Description |
|------|-------------|
| `-c` | Show copy button |

## Multi-line Commands

```tsx
<Terminal
  codeblock={{
    value: `git clone https://github.com/example/repo.git
cd repo
npm install
npm run dev`,
    lang: 'bash',
    meta: '-c',
  }}
/>
```

## Visual Style

The terminal component renders:
- A header bar with three dots (red, yellow, green style, but muted)
- Dark background for the command area
- Monospace font for commands
- Optional floating copy button

## When to Use

| Component | Use Case |
|-----------|----------|
| `Terminal` | Shell commands, CLI examples |
| `DocsKitCode` | Source code with syntax highlighting |
| `PackageInstall` | Package installation with manager tabs |

## Server vs Client

| Component | Use Case |
|-----------|----------|
| `Terminal` | Server-rendered pages, few terminals |
| `ClientTerminal` | Many terminals, client components |

## See Also

- [Package Install](./package-install.md) - Package manager tabs
- [Code Blocks](./code-blocks.md) - General code blocks
- [Client Components](./client-components.md) - Client-side variants
