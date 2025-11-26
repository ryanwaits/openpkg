# OpenPkg Schema

The OpenPkg 0.2.0 JSON Schema specification.

## Schema URL

```
https://openpkg.dev/schemas/v0.2.0/openpkg.schema.json
```

## Using the Schema

Add `$schema` to your `openpkg.json`:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.2.0/openpkg.schema.json",
  "openpkg": "0.2.0",
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
  "openpkg": "0.2.0",
  "meta": { ... },
  "exports": [ ... ],
  "types": [ ... ],
  "docs": { ... },
  "examples": [ ... ],
  "extensions": { ... }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `openpkg` | `"0.2.0"` | Schema version |
| `meta` | `object` | Package metadata |
| `exports` | `array` | Exported items |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `$schema` | `string` | JSON Schema URL |
| `types` | `array` | Type definitions |
| `docs` | `object` | Coverage metadata |
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
  "examples": ["createUser('Alice')"],
  "docs": {
    "coverageScore": 100,
    "missing": [],
    "drift": []
  }
}
```

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

## Docs Metadata

```json
{
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
| 0.2.0 | Current |
| 0.1.0 | Deprecated |

### 0.2.0 Changes

- Added `docs.drift` array
- Added `docs.coverageScore`
- Added `docs.missing` array
- Added drift type definitions

## See Also

- [Types Reference](../spec/types.md) - TypeScript types
- [Drift Types](../spec/drift-types.md) - Drift detection
- [Spec Overview](../spec/overview.md) - Package overview

