# OpenPkg Schema

The OpenPkg 0.3.0 JSON Schema specification.

> **Note**: OpenPkg is a pure structural format. Coverage data (`coverageScore`, `missing`, `drift`) is computed by DocCov's `enrichSpec()` and is not part of this schema.

## Schema URL

```
https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json
```

## Using the Schema

Add `$schema` to your `openpkg.json`:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
  "openpkg": "0.3.0",
  "meta": {
    "name": "my-package"
  },
  "exports": []
}
```

This enables:
- IDE autocompletion
- Inline validation
- Hover documentation

## Schema Location

The schema file is at:

```
packages/spec/schemas/v0.2.0/openpkg.schema.json
```

## Validation

### Using @openpkg-ts/spec

```typescript
import { validateSpec, normalize } from '@openpkg-ts/spec';

const spec = JSON.parse(fs.readFileSync('openpkg.json', 'utf-8'));
const normalized = normalize(spec);
const result = validateSpec(normalized);

if (!result.ok) {
  console.error('Validation errors:');
  for (const error of result.errors) {
    console.error(`  ${error.instancePath}: ${error.message}`);
  }
} else {
  console.log('Valid spec!');
}
```

### Using assertSpec

Throws on invalid spec:

```typescript
import { assertSpec } from '@openpkg-ts/spec';

try {
  assertSpec(spec);
  console.log('Valid!');
} catch (error) {
  console.error('Invalid:', error.message);
}
```

### Using getValidationErrors

Get errors without throwing:

```typescript
import { getValidationErrors } from '@openpkg-ts/spec';

const errors = getValidationErrors(spec);
if (errors.length > 0) {
  console.log('Errors:', errors);
}
```

## Root Object

```json
{
  "$schema": "string (optional)",
  "openpkg": "0.3.0",
  "meta": { ... },
  "exports": [ ... ],
  "types": [ ... ],
  "examples": [ ... ],
  "extensions": { ... }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `openpkg` | `"0.3.0"` | Schema version |
| `meta` | `object` | Package metadata |
| `exports` | `array` | Exported items |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | `string` | JSON Schema URL |
| `types` | `array` | Type definitions |
| `examples` | `array` | Package examples |
| `extensions` | `object` | Custom extensions |

## Meta Object

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "description": "Package description",
  "license": "MIT",
  "repository": "https://github.com/org/repo"
}
```

### Required

| Field | Type |
|-------|------|
| `name` | `string` |

### Optional

| Field | Type |
|-------|------|
| `version` | `string` |
| `description` | `string` |
| `license` | `string` |
| `repository` | `string` |
| `ecosystem` | `string` |

## Export Object

```json
{
  "id": "createUser",
  "name": "createUser",
  "kind": "function",
  "description": "Creates a user",
  "signatures": [...],
  "examples": ["createUser('Alice')"]
}
```

> **Note**: The `docs` field with `coverageScore`, `missing`, and `drift` only appears on `EnrichedExport` types returned by `enrichSpec()`, not in the pure OpenPkg format.

### Required

| Field | Type |
|-------|------|
| `id` | `string` |
| `name` | `string` |
| `kind` | `string` |

### Export Kinds

```typescript
type SpecExportKind =
  | 'function'
  | 'class'
  | 'variable'
  | 'interface'
  | 'type'
  | 'enum'
  | 'module'
  | 'namespace'
  | 'reference';
```

## Signature Object

```json
{
  "parameters": [
    {
      "name": "id",
      "required": true,
      "description": "User ID",
      "schema": { "type": "string" }
    }
  ],
  "returns": {
    "schema": { "$ref": "#/types/User" },
    "description": "The user object"
  },
  "typeParameters": [
    {
      "name": "T",
      "constraint": "object"
    }
  ]
}
```

## Enriched Specs (DocCov Layer)

Coverage metadata is computed by DocCov's `enrichSpec()` function and is NOT part of the OpenPkg schema. When you call `enrichSpec()` or use `doccov check --format json`, the output includes:

```json
{
  "docs": {
    "coverageScore": 75,
    "missing": ["examples"],
    "drift": [
      {
        "type": "param-mismatch",
        "target": "userId",
        "issue": "@param userId not in signature",
        "suggestion": "id"
      }
    ]
  }
}
```

### Missing Signals

```typescript
type SpecDocSignal = 'description' | 'params' | 'returns' | 'examples';
```

### Drift Types

```typescript
type SpecDocDrift = {
  type:
    | 'param-mismatch'
    | 'param-type-mismatch'
    | 'return-type-mismatch'
    | 'generic-constraint-mismatch'
    | 'optionality-mismatch'
    | 'deprecated-mismatch'
    | 'visibility-mismatch'
    | 'example-drift'
    | 'example-runtime-error'
    | 'broken-link';
  target?: string;
  issue: string;
  suggestion?: string;
};
```

For coverage analysis, use the SDK's `enrichSpec()` or the CLI's `doccov check --format json`.

## Type References

Use `$ref` for type references:

```json
{
  "schema": { "$ref": "#/types/User" }
}
```

Primitives are inline:

```json
{
  "schema": { "type": "string" }
}
```

## Version History

| Version | Status |
|---------|--------|
| 0.3.0 | Current |
| 0.2.0 | Deprecated |
| 0.1.0 | Deprecated |

### 0.3.0 Changes

- Removed `docs` field from pure OpenPkg (moved to enriched layer)
- Coverage data now computed on-demand via `enrichSpec()`
- OpenPkg is now a pure structural format

### 0.2.0 Changes

- Added `docs.drift` array
- Added `docs.coverageScore`
- Added `docs.missing` array
- Added drift type definitions

## See Also

- [Types Reference](../spec/types.md) - TypeScript types
- [Drift Types](../spec/drift-types.md) - Drift detection
- [Spec Overview](../spec/overview.md) - Package overview

