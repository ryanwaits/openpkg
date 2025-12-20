# Configuration

DocCov configuration file for persistent settings.

## Config File

Create a config file in your project root:

```bash
doccov init              # TypeScript config
doccov init --format yaml  # YAML config (simpler)
```

Supported formats:

- `doccov.yml` / `doccov.yaml` (recommended for simplicity)
- `doccov.config.ts`
- `doccov.config.js`
- `doccov.config.mjs`
- `doccov.config.cjs`

## Schema

### YAML Format

```yaml
# doccov.yml
include:
  - "createUser"
  - "update*"
  - "User*"

exclude:
  - "_internal*"
  - "debug*"

docs:
  include:
    - "docs/**/*.md"
    - "README.md"

check:
  minCoverage: 80
  maxDrift: 10
  examples: typecheck

quality:
  rules:
    has-description: error
    has-examples: warn
```

### TypeScript Format

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

  // Check command defaults
  check: {
    examples: 'typecheck',
    minCoverage: 80,
    maxDrift: 10,
  },

  // Quality rules configuration
  quality: {
    rules: {
      'missing-description': 'error',
      'missing-example': 'warn',
    },
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

### check

Type: `{ examples?: string | string[], minCoverage?: number, maxDrift?: number }`

Configure defaults for the `check` command.

```typescript
export default defineConfig({
  check: {
    // Example validation mode(s): 'presence', 'typecheck', 'run'
    // Can be single value, array, or comma-separated string
    examples: 'typecheck',

    // Minimum coverage percentage (0-100)
    minCoverage: 80,

    // Maximum drift percentage (0-100)
    maxDrift: 10,
  },
});
```

CLI flags override these settings:

```bash
# Config sets minCoverage: 80, but CLI overrides to 90
doccov check --min-coverage 90
```

### quality

Type: `{ rules?: Record<string, 'error' | 'warn' | 'off'> }`

Configure quality rule severities.

```typescript
export default defineConfig({
  quality: {
    rules: {
      'missing-description': 'error',   // Fail on missing descriptions
      'missing-example': 'warn',         // Warn on missing examples
      'missing-param-description': 'off', // Disable this rule
    },
  },
});
```

Available severity levels:

| Level | Behavior |
|-------|----------|
| `error` | Causes check to fail (exit 1) |
| `warn` | Shows warning but doesn't fail |
| `off` | Disables the rule |

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

Config is auto-loaded by `spec` and `check`:

```bash
# Uses doccov.config.ts automatically
doccov spec
doccov check
```

CLI flags override config:

```bash
# Overrides config include
doccov spec --include "specificExport"
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
2. `doccov.config.mts`
3. `doccov.config.cts`
4. `doccov.config.js`
5. `doccov.config.mjs`
6. `doccov.config.cjs`
7. `doccov.yml`
8. `doccov.yaml`

In the working directory (or `--cwd` if specified).

## Local Testing

```bash
# Create config
bun run packages/cli/src/cli.ts init

# Test with config
bun run packages/cli/src/cli.ts spec
```

## See Also

- [init](./commands/init.md) - Create config file
- [spec](./commands/spec.md) - Uses config for filtering
- [check](./commands/check.md) - Uses config for filtering
- [diff](./commands/diff.md) - Uses config for docs paths
- [Filtering](../sdk/filtering.md) - SDK filtering API

