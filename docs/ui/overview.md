# UI Components

The `@doccov/ui` package provides React components for building documentation sites and developer tools.

## Packages

| Export | Description |
|--------|-------------|
| `@doccov/ui` | Core UI components (Button, Badge, Input, etc.) |
| `@doccov/ui/docskit` | Documentation components (code blocks, terminals, annotations) |

## Installation

```bash
bun add @doccov/ui
```

## DocsKit Components

Documentation-focused components powered by CodeHike for syntax highlighting.

- [Code Blocks](./docskit/code-blocks.md) - Syntax-highlighted code with titles, copy buttons
- [Terminal](./docskit/terminal.md) - macOS-style terminal blocks
- [Package Install](./docskit/package-install.md) - Package manager command tabs
- [Code Tabs](./docskit/code-tabs.md) - Tabbed multi-file code blocks
- [Inline Code](./docskit/inline-code.md) - Inline syntax highlighting
- [Annotations](./docskit/annotations.md) - Mark, diff, collapse, hover, tooltip
- [Client Components](./docskit/client-components.md) - Client-side highlighting variants
- [Skeletons](./docskit/skeletons.md) - Loading state components

## Base Components

General-purpose UI components.

- [Button](./components/button.md) - Button variants and states
- [Badge](./components/badge.md) - Status and kind badges
- [Input](./components/input.md) - Text inputs with variants
- [Tabs](./components/tabs.md) - Tab navigation
- [Collapsible](./components/collapsible.md) - Expandable sections

## Theming

DocsKit components use CSS custom properties for theming:

```css
/* Code block theming */
--dk-background: /* code block background */
--dk-border: /* border color */
--dk-tabs-background: /* tab bar background */
--dk-tab-active-foreground: /* active tab text */
--dk-tab-inactive-foreground: /* inactive tab text */
--dk-active-border: /* active tab border */
--dk-selection: /* text selection color */
```

## See Also

- [Demo Page](/demo) - Live component showcase
- [GitHub](https://github.com/doccov/doccov) - Source code
