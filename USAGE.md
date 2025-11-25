# DocCov Usage Guide

## Quick Start

1. Install the CLI:
```bash
npm install -g @doccov/cli
```

2. Check documentation coverage:
```bash
doccov check --min-coverage 80
```

3. Generate an OpenPkg spec:
```bash
doccov generate --output openpkg.json
```

## CLI Commands

### `doccov check`

Validate documentation coverage and detect drift.

```bash
doccov check [entry] [options]
```

Options:
- `--min-coverage <percentage>` - Minimum docs coverage percentage (0-100), default: 80
- `--require-examples` - Require at least one `@example` for every export
- `--no-external-types` - Skip external type resolution from node_modules
- `--cwd <dir>` - Working directory
- `--package <name>` - Target package name (for monorepos)

Examples:
```bash
# Basic coverage check
doccov check

# Strict mode: require examples and 90% coverage
doccov check --min-coverage 90 --require-examples

# Check a specific package in a monorepo
doccov check --package @myorg/utils
```

### `doccov generate`

Generate an OpenPkg specification file.

```bash
doccov generate [entry] [options]
```

Options:
- `-o, --output <file>` - Output file (default: `openpkg.json`)
- `--include <ids>` - Filter exports by identifier
- `--exclude <ids>` - Exclude exports by identifier
- `--show-diagnostics` - Print TypeScript diagnostics
- `--no-external-types` - Skip external type resolution
- `--cwd <dir>` - Working directory
- `-p, --package <name>` - Target package name (for monorepos)

Examples:
```bash
# Generate spec with auto-detected entry
doccov generate

# Custom output file
doccov generate -o api-spec.json

# Only include specific exports
doccov generate --include "createUser,updateUser,deleteUser"
```

### `doccov init`

Create a DocCov configuration file.

```bash
doccov init [options]
```

Options:
- `--format <format>` - Config format: auto, mjs, js, cjs
- `--cwd <dir>` - Working directory

## Configuration File

Create `doccov.config.ts` (or `.js`, `.mjs`, `.cjs`) in your project root:

```typescript
import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  include: ['createUser', 'updateUser'],
  exclude: ['internalHelper'],
});
```

## Understanding the Output

The generated `openpkg.json` contains:

1. **meta** - Package metadata (name, version, description)
2. **exports** - All exported functions, classes, variables, types
3. **types** - Detailed type definitions referenced by exports
4. **docs** - Documentation coverage metadata

### Coverage Metadata

Each export includes documentation coverage info:

```json
{
  "name": "createUser",
  "kind": "function",
  "docs": {
    "coverageScore": 75,
    "missing": ["examples"],
    "drift": [
      {
        "type": "param-mismatch",
        "target": "userId",
        "issue": "JSDoc documents parameter \"userId\" which is not present in the signature.",
        "suggestion": "id"
      }
    ]
  }
}
```

### Type Reference System

OpenPkg follows OpenAPI's approach to type references:

#### Primitive Types
Always inline:
```json
{ "type": "string" }
{ "type": "number" }
```

#### Named Types
Use `$ref`:
```json
{
  "parameters": [{
    "name": "user",
    "schema": { "$ref": "#/types/User" }
  }]
}
```

## SDK Usage

### Basic Analysis

```typescript
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Package: ${result.spec.meta.name}`);
console.log(`Coverage: ${result.spec.docs?.coverageScore}%`);
console.log(`Exports: ${result.spec.exports.length}`);
```

### With Filters

```typescript
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['createUser', 'updateUser'],
    exclude: ['_internal*'],
  },
});
```

### Checking for Drift

```typescript
for (const exp of result.spec.exports) {
  const drift = exp.docs?.drift ?? [];
  if (drift.length > 0) {
    console.log(`\n${exp.name} has ${drift.length} drift issue(s):`);
    for (const d of drift) {
      console.log(`  - ${d.issue}`);
      if (d.suggestion) {
        console.log(`    Suggestion: ${d.suggestion}`);
      }
    }
  }
}
```

## Spec Validation

```typescript
import { normalize, validateSpec, diffSpec } from '@openpkg-ts/spec';

// Validate a spec
const normalized = normalize(spec);
const result = validateSpec(normalized);
if (!result.ok) {
  console.error('Validation failed:', result.errors);
}

// Diff two specs
const diff = diffSpec(oldSpec, newSpec);
console.log('Breaking changes:', diff.breaking);
console.log('New exports:', diff.nonBreaking);
console.log('Docs-only changes:', diff.docsOnly);
```

## CI Integration

### GitHub Actions

```yaml
name: Docs Coverage
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx @doccov/cli check --min-coverage 80
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx doccov check --min-coverage 80
```

## Next Steps

- Add a DocCov badge to your README
- Set up PR comments for coverage changes
- Configure stricter thresholds as your docs improve
