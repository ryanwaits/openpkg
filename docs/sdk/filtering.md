# Filtering

Filter which exports are included in analysis.

## FilterOptions

```typescript
interface FilterOptions {
  include?: string[];       // Patterns to include
  exclude?: string[];       // Patterns to exclude
  visibility?: ReleaseTag[];  // Release stage filter
}

type ReleaseTag = 'public' | 'beta' | 'alpha' | 'internal';
```

## Pattern Syntax

Supports wildcards:

| Pattern | Matches |
|---------|---------|
| `MyClass` | Exact name |
| `use*` | Starts with "use" |
| `*Helper` | Ends with "Helper" |
| `*util*` | Contains "util" |

## Usage

### In DocCov

```typescript
const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['MyClass', 'use*'],
    exclude: ['*Internal', '_*'],
    visibility: ['public', 'beta'],
  }
});
```

### applyFilters Function

```typescript
import { applyFilters } from '@doccov/sdk';

const filtered = applyFilters(spec, {
  include: ['MyClass'],
  exclude: ['*Internal'],
});
```

## Visibility Filtering

Filter by JSDoc release tags:

```typescript
/**
 * @public
 */
export function publicApi() {}

/**
 * @beta
 */
export function betaApi() {}

/**
 * @internal
 */
export function internalApi() {}
```

```typescript
// Only public exports
{ visibility: ['public'] }

// Public and beta
{ visibility: ['public', 'beta'] }
```

## Type Dependencies

When filtering, dependent types are automatically included:

```typescript
export interface Options { /* ... */ }
export function createThing(opts: Options) { /* ... */ }
```

If `createThing` is included, `Options` is automatically included.

## Diagnostics

Filters generate diagnostics for:
- Unmatched include patterns
- Types excluded that are dependencies

```typescript
const result = await doccov.analyzeFileWithDiagnostics(path, { filters });

for (const diag of result.diagnostics) {
  if (diag.message.includes('filter')) {
    console.warn(diag.message);
  }
}
```
