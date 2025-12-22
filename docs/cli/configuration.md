# Configuration

DocCov supports multiple config file formats with automatic discovery.

## Config Files

Searched in order (first found wins):

1. `doccov.config.ts` / `doccov.config.mts` / `doccov.config.cts`
2. `doccov.config.js` / `doccov.config.mjs` / `doccov.config.cjs`
3. `doccov.yml` / `doccov.yaml`

## YAML Example

```yaml
# doccov.yml
include:
  - "MyClass"
  - "use*"
exclude:
  - "*Internal"
  - "_*"

docs:
  include:
    - "docs/**/*.md"

check:
  minCoverage: 80
  maxDrift: 10
  examples: typecheck  # 'presence' | 'typecheck' | 'run'

quality:
  rules:
    has-description: error
    has-params: warn
    has-examples: off
```

## TypeScript Example

```typescript
// doccov.config.ts
import { defineConfig } from '@doccov/cli';

export default defineConfig({
  include: ['MyClass', 'use*'],
  exclude: ['*Internal'],

  check: {
    minCoverage: 80,
    maxDrift: 10,
    examples: ['presence', 'typecheck'],
  },

  quality: {
    rules: {
      'has-description': 'error',
      'has-params': 'warn',
    },
  },

  // Pro tier: per-path policies
  policies: [
    {
      path: 'src/public/**',
      minCoverage: 95,
      requireExamples: true,
    },
  ],
});
```

## Schema Reference

### Root Options

| Field | Type | Description |
|-------|------|-------------|
| `include` | `string \| string[]` | Export patterns to include |
| `exclude` | `string \| string[]` | Export patterns to exclude |
| `plugins` | `unknown[]` | Reserved for plugins |

### `docs` Section

| Field | Type | Description |
|-------|------|-------------|
| `include` | `string \| string[]` | Markdown doc glob patterns |
| `exclude` | `string \| string[]` | Docs to exclude |

### `check` Section

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `minCoverage` | `number` | - | Minimum coverage % (0-100) |
| `maxDrift` | `number` | - | Maximum drift % (0-100) |
| `examples` | `string \| string[]` | - | `'presence'`, `'typecheck'`, `'run'` |

### `quality` Section

| Field | Type | Description |
|-------|------|-------------|
| `rules` | `Record<string, Severity>` | Rule ID → `'error'` \| `'warn'` \| `'off'` |

**Available Rules:**

Core (affect coverage):
- `has-description` - Export has description
- `has-params` - Function params documented
- `has-returns` - Return documented
- `has-examples` - Has @example block

TSDoc:
- `require-release-tag` - Has @public/@beta/@alpha/@internal
- `internal-underscore` - @internal exports start with _
- `no-conflicting-tags` - No mixed visibility tags
- `no-forgotten-export` - Referenced types exported

### `policies` Section (Pro)

```typescript
interface Policy {
  path: string;           // Glob pattern
  minCoverage?: number;   // 0-100
  maxDrift?: number;      // 0-100
  requireExamples?: boolean;
}
```

## CLI Override

CLI flags override config values:

```bash
# Config has minCoverage: 80, CLI overrides to 90
doccov check --min-coverage 90
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DOCCOV_API_KEY` | API key for hosted AI generation |
| `OPENAI_API_KEY` | Local AI generation (fallback) |
| `ANTHROPIC_API_KEY` | Local AI generation (fallback) |
