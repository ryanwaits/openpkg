# Configuration

DocCov configuration file for persistent settings.

## Config File

Create `doccov.config.ts` in your project root:

```bash
doccov init
```

Or manually create any of:

- `doccov.config.ts`
- `doccov.config.js`
- `doccov.config.mjs`
- `doccov.config.cjs`

## Schema

```typescript
import { defineConfig } from '@doccov/sdk';

export default defineConfig({
  // Include only these exports (glob patterns)
  include: ['createUser', 'update*', 'User*'],
  
  // Exclude these exports (glob patterns)
  exclude: ['_internal*', 'debug*', '*Helper'],
  
  // Markdown documentation paths (for diff --docs)
  docs: {
    include: ['docs/**/*.md', 'README.md'],
    exclude: ['docs/archive/**'],
  },
});
```

## Options

### include

Type: `string[]`

Only include exports matching these patterns.

```typescript
export default defineConfig({
  include: [
    'createUser',      // Exact match
    'update*',         // Starts with "update"
    '*Handler',        // Ends with "Handler"
    'User*Service',    // Glob pattern
  ],
});
```

### exclude

Type: `string[]`

Exclude exports matching these patterns. Applied after `include`.

```typescript
export default defineConfig({
  exclude: [
    '_*',              // Internal exports
    '*Internal',       // Suffix pattern
    'debug*',          // Debug utilities
    'test*',           // Test helpers
  ],
});
```

### docs

Type: `{ include?: string[], exclude?: string[] }`

Configure markdown documentation paths for impact analysis with `doccov diff`.

```typescript
export default defineConfig({
  docs: {
    include: ['docs/**/*.md', 'docs/**/*.mdx', 'README.md'],
    exclude: ['docs/archive/**', 'docs/deprecated/**'],
  },
});
```

When configured, `doccov diff` automatically analyzes these files without needing `--docs` flags:

```bash
# Uses docs paths from config
doccov diff base.json head.json
```

## Pattern Syntax

Patterns use glob-style matching:

| Pattern | Matches |
|---------|---------|
| `foo` | Exact match "foo" |
| `foo*` | Starts with "foo" |
| `*foo` | Ends with "foo" |
| `*foo*` | Contains "foo" |
| `foo*bar` | Starts with "foo", ends with "bar" |

## Examples

### Public API Only

```typescript
export default defineConfig({
  exclude: ['_*', '*Internal', '*Private'],
});
```

### Specific Modules

```typescript
export default defineConfig({
  include: ['User*', 'Auth*', 'Session*'],
});
```

### Exclude Test Utilities

```typescript
export default defineConfig({
  exclude: ['test*', 'mock*', '*Mock', '*Stub'],
});
```

### Docs Impact Analysis

```typescript
export default defineConfig({
  docs: {
    include: [
      'docs/**/*.md',
      'docs/**/*.mdx',
      'README.md',
      'CHANGELOG.md',
    ],
    exclude: [
      'docs/archive/**',
      'docs/internal/**',
    ],
  },
});
```

## Usage with CLI

Config is auto-loaded by `generate` and `check`:

```bash
# Uses doccov.config.ts automatically
doccov generate
doccov check
```

CLI flags override config:

```bash
# Overrides config include
doccov generate --include "specificExport"
```

## TypeScript Support

Using `defineConfig` provides type hints:

```typescript
import { defineConfig } from '@doccov/sdk';

export default defineConfig({
  include: ['*'],  // Autocomplete available
});
```

## Config Resolution

DocCov looks for config in this order:

1. `doccov.config.ts`
2. `doccov.config.js`
3. `doccov.config.mjs`
4. `doccov.config.cjs`

In the working directory (or `--cwd` if specified).

## Local Testing

```bash
# Create config
bun run packages/cli/src/cli.ts init

# Test with config
bun run packages/cli/src/cli.ts generate
```

## See Also

- [init](./commands/init.md) - Create config file
- [generate](./commands/generate.md) - Uses config for filtering
- [diff](./commands/diff.md) - Uses config for docs paths
- [Filtering](../sdk/filtering.md) - SDK filtering API

