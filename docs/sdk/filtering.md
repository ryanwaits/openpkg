# Filtering

Filter which exports are included in analysis.

## Import

```typescript
import type { FilterOptions } from '@doccov/sdk';
```

## FilterOptions

```typescript
interface FilterOptions {
  include?: string[];  // Only include matching exports
  exclude?: string[];  // Exclude matching exports
}
```

## Usage

### With DocCov Class

```typescript
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['create*', 'update*'],
    exclude: ['_*'],
  },
});
```

### Include Only

```typescript
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['User*', 'Auth*'],
  },
});
```

### Exclude Only

```typescript
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    exclude: ['_internal*', '*Helper', 'test*'],
  },
});
```

## Pattern Syntax

Patterns use glob-style matching:

| Pattern | Matches | Examples |
|---------|---------|----------|
| `foo` | Exact match | `foo` |
| `foo*` | Starts with | `fooBar`, `fooHelper` |
| `*foo` | Ends with | `helperFoo`, `createFoo` |
| `*foo*` | Contains | `myFooHelper`, `fooBar` |
| `foo*bar` | Starts with, ends with | `fooMyBar` |

## Order of Application

1. If `include` is set, only matching exports are considered
2. Then `exclude` patterns are applied to remove matches

```typescript
// Start with: createUser, updateUser, _createInternal, _updateInternal

filters: {
  include: ['*User', '*Internal'],  // createUser, updateUser, _createInternal, _updateInternal
  exclude: ['_*'],                   // createUser, updateUser
}

// Result: createUser, updateUser
```

## Common Patterns

### Public API Only

```typescript
filters: {
  exclude: ['_*', '*Internal', '*Private'],
}
```

### Specific Feature

```typescript
filters: {
  include: ['User*', 'createUser', 'updateUser', 'deleteUser'],
}
```

### Exclude Test Utilities

```typescript
filters: {
  exclude: ['test*', 'mock*', '*Mock', '*Stub', '*Fixture'],
}
```

### CRUD Operations

```typescript
filters: {
  include: ['create*', 'read*', 'update*', 'delete*', 'get*', 'set*'],
}
```

## CLI Usage

Same patterns work with CLI:

```bash
doccov generate --include "User*,Auth*" --exclude "_*"
doccov check --include "create*,update*"
```

## Config File

Persistent filters in `doccov.config.ts`:

```typescript
import { defineConfig } from '@doccov/cli/config';

export default defineConfig({
  include: ['create*', 'update*', 'delete*'],
  exclude: ['_*', '*Internal'],
});
```

## Filtering Behavior

### Empty Include

If `include` is empty or not set, all exports are included.

```typescript
filters: { include: [] }  // All exports included
filters: {}               // All exports included
```

### Empty Exclude

If `exclude` is empty or not set, no exports are excluded.

```typescript
filters: { exclude: [] }  // No exclusions
```

### No Match

If `include` patterns match nothing, result has no exports.

```typescript
filters: { include: ['NonExistent*'] }  // Zero exports
```

## Local Testing

```bash
# Test filtering
bun run packages/cli/src/cli.ts generate tests/fixtures/simple-math.ts \
  --include "add,subtract" \
  -o /tmp/filtered.json

# Check result
cat /tmp/filtered.json | jq '.exports[].name'
```

## See Also

- [Configuration](../cli/configuration.md) - Persistent filters
- [generate Command](../cli/commands/generate.md) - CLI filtering
- [DocCov Class](./doccov-class.md) - SDK filtering

