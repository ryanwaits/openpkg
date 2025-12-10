# Spec Overview

The `@openpkg-ts/spec` package provides the OpenPkg 0.3.0 schema, TypeScript types, validation, and diffing utilities.

OpenPkg is a **pure structural format** - it describes the API shape without coverage or quality metadata. Coverage analysis is handled separately by the DocCov SDK via `enrichSpec()`.

## Installation

```bash
npm install @openpkg-ts/spec
```

## Exports

```typescript
import {
  // Types
  type OpenPkg,
  type SpecExport,
  type SpecType,
  type SpecSignature,
  type SpecDocsMetadata,
  type SpecDocDrift,

  // Validation
  validateSpec,
  assertSpec,
  getValidationErrors,

  // Utilities
  normalize,
  dereference,
  diffSpec,

  // Constants
  CURRENT_VERSION,
} from '@openpkg-ts/spec';
```

## Schema Version

Current version: `0.3.0`

JSON Schema: `packages/spec/schemas/v0.3.0/openpkg.schema.json`

## OpenPkg Structure

OpenPkg is a pure structural format - no coverage data at this level:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
  "openpkg": "0.3.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0",
    "description": "Package description",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "createUser",
      "name": "createUser",
      "kind": "function",
      "description": "Creates a user",
      "signatures": [...]
    }
  ],
  "types": [
    {
      "id": "User",
      "name": "User",
      "kind": "interface",
      "members": [...]
    }
  ]
}
```

For coverage analysis, use the DocCov SDK's `enrichSpec()` function - see [SDK Overview](../sdk/overview.md).

## Validation

```typescript
import { validateSpec, normalize } from '@openpkg-ts/spec';

const spec = JSON.parse(fs.readFileSync('openpkg.json', 'utf-8'));
const normalized = normalize(spec);
const result = validateSpec(normalized);

if (!result.ok) {
  console.error('Validation errors:', result.errors);
}
```

## Normalization

The `normalize()` function ensures consistent structure:

```typescript
import { normalize } from '@openpkg-ts/spec';

const normalized = normalize(spec);
// Fills in defaults, ensures arrays exist, etc.
```

## Dereferencing

Resolve `$ref` pointers to actual type definitions:

```typescript
import { dereference } from '@openpkg-ts/spec';

const dereferenced = dereference(spec);
// All $ref pointers replaced with actual types
```

## Diffing

Compare two specs for changes:

```typescript
import { diffSpec } from '@openpkg-ts/spec';

const diff = diffSpec(oldSpec, newSpec);
console.log(diff.coverageDelta);     // +5 or -3
console.log(diff.breaking);          // Removed exports
console.log(diff.newUndocumented);   // New exports without docs
```

## Local Testing

```bash
# Run spec tests
bun test packages/spec/test/

# Test validation
bun run -e "
  import { validateSpec } from './packages/spec/src';
  const spec = require('./openpkg.json');
  console.log(validateSpec(spec));
"
```

## See Also

- [Types Reference](./types.md) - Full type definitions
- [Drift Types](./drift-types.md) - All drift detectors
- [Diffing](./diffing.md) - Spec comparison API

