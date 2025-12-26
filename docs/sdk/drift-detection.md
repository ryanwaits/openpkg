# Drift Detection

Detect discrepancies between documentation and actual code.

> **Types:** Drift types are defined in `@doccov/spec`

## Drift Types

| Type | Category | Description |
|------|----------|-------------|
| `param-mismatch` | structural | Documented params don't match signature |
| `param-type-mismatch` | structural | Parameter type doesn't match docs |
| `return-type-mismatch` | structural | Return type doesn't match docs |
| `optionality-mismatch` | structural | Required/optional doesn't match |
| `generic-constraint-mismatch` | structural | Generic constraint changed |
| `property-type-drift` | structural | Class/interface property mismatch |
| `async-mismatch` | structural | Promise/async inconsistency |
| `deprecated-mismatch` | semantic | Missing/incorrect @deprecated |
| `visibility-mismatch` | semantic | Release tag inconsistency |
| `broken-link` | semantic | Reference to non-exported type |
| `example-drift` | example | @example doesn't match current API |
| `example-syntax-error` | example | Invalid code in @example |
| `example-runtime-error` | example | @example fails at runtime |
| `example-assertion-failed` | example | @example assertion failed |

## Categories

```typescript
type DriftCategory = 'structural' | 'semantic' | 'example';
```

- **structural** - JSDoc types/params don't match code (auto-fixable)
- **semantic** - Metadata/visibility issues
- **example** - Code example problems

## Usage

### Compute Drift

```typescript
import { computeDrift, computeExportDrift } from '@doccov/sdk';

// For entire spec
const drift = computeDrift(spec);
// drift.exports: Map<exportId, SpecDocDrift[]>

// For single export
const exportDrift = computeExportDrift(exportData, exportRegistry);
// exportDrift: SpecDocDrift[]
```

### Categorize & Summarize

```typescript
import { categorizeDrift, getDriftSummary } from '@doccov/sdk';

const categorized = categorizeDrift(drifts);
// categorized[].category: DriftCategory
// categorized[].fixable: boolean

const summary = getDriftSummary(drifts);
// summary.total: number
// summary.byCategory: Record<DriftCategory, number>
// summary.fixable: number
```

## DocCovDrift Type

```typescript
// From @doccov/spec
interface DocCovDrift {
  type: DriftType;
  target?: string;      // e.g., param name
  issue: string;        // Human-readable description
  suggestion?: string;  // Fix suggestion
  category: DriftCategory;  // structural | semantic | example
  fixable: boolean;     // Can be auto-fixed
}
```

## Examples

### Param Mismatch

```typescript
/**
 * @param name - The name
 * @param age - The age   // DRIFT: 'age' doesn't exist
 */
function greet(name: string) {}
```

```json
{
  "type": "param-mismatch",
  "target": "age",
  "issue": "Documented param 'age' not in signature",
  "suggestion": "Remove @param age"
}
```

### Return Type Mismatch

```typescript
/**
 * @returns {string} The result  // DRIFT: actually returns number
 */
function calculate(): number {}
```

### Broken Link

```typescript
/**
 * @see InternalHelper  // DRIFT: not exported
 */
export function publicFn() {}
```

## Auto-Fix

Many structural drifts are auto-fixable:

```typescript
import { generateFix, isFixableDrift } from '@doccov/sdk';

for (const drift of drifts) {
  if (isFixableDrift(drift)) {
    const patch = generateFix(drift, exportData);
    // patch.original: string
    // patch.patched: string
  }
}
```

Fixable drift types:
- `param-mismatch`
- `param-type-mismatch`
- `return-type-mismatch`
- `optionality-mismatch`

Non-fixable (require manual intervention):
- `example-*` types
- `broken-link`
- `visibility-mismatch`
