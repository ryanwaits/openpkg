# Package Install

Package installation commands with tabs for different package managers (npm, yarn, pnpm, bun).

## Import

```typescript
import { PackageInstall } from '@doccov/ui/docskit';
```

## Basic Usage

```tsx
<PackageInstall package="@doccov/ui" />
```

Renders tabs with:
- `npm install @doccov/ui`
- `yarn add @doccov/ui`
- `pnpm add @doccov/ui`
- `bun add @doccov/ui`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `package` | `string` | required | Package name to install |
| `dev` | `boolean` | `false` | Install as dev dependency |
| `global` | `boolean` | `false` | Install globally |

## Dev Dependency

```tsx
<PackageInstall package="typescript" dev />
```

Renders:
- `npm install -D typescript`
- `yarn add -D typescript`
- `pnpm add -D typescript`
- `bun add -d typescript`

## Global Install

```tsx
<PackageInstall package="@doccov/cli" global />
```

Renders:
- `npm install -g @doccov/cli`
- `yarn global add @doccov/cli`
- `pnpm add -g @doccov/cli`
- `bun add -g @doccov/cli`

## Features

- Remembers selected package manager (localStorage)
- Synced selection across all `PackageInstall` components on the page
- macOS-style terminal header with traffic light dots
- Copy button for easy clipboard access

## Styling

Uses the same terminal styling as the `Terminal` component:

```css
--dk-background: /* terminal background */
--dk-border: /* border color */
--dk-tabs-background: /* tab bar background */
```

## Note

This is a client component (`"use client"`) - it manages tab state and localStorage. It does not use Code Hike highlighting (commands are static text).

## See Also

- [Terminal](./terminal.md) - Generic terminal blocks
- [Code Tabs](./code-tabs.md) - Tabbed code with highlighting
