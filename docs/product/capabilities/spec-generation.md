# Spec Generation (OpenPkg)

> Last updated: 2024-12-08

Deep dive into DocCov's OpenPkg specification generation.

---

## Overview

DocCov generates structured specifications in the **OpenPkg** format - an open standard for TypeScript API documentation.

OpenPkg is a **pure structural format** - it captures what your package exports without quality metrics. Coverage scoring and drift detection are separate concerns handled by DocCov's analysis layer.

---

## OpenPkg Format

### Version
Current: `0.3.0`

### Schema
JSON Schema published at: `packages/spec/schemas/v0.3.0/openpkg.schema.json`

### Structure

OpenPkg is a pure structural format:

```typescript
interface OpenPkg {
  $schema?: string;           // Schema reference
  openpkg: string;            // Version (e.g., "0.3.0")
  meta: OpenPkgMeta;          // Package metadata
  exports: SpecExport[];      // Public exports
  types?: SpecType[];         // Supporting type definitions
  examples?: SpecExample[];   // Global examples
  extensions?: SpecExtension; // Custom extensions
}
```

> **Note**: Coverage data (`docs.coverageScore`, `docs.missing`, `docs.drift`) is computed by DocCov using `enrichSpec()` and is not part of the OpenPkg schema.

---

## What We Capture

### Export Metadata
- Name, kind, ID
- Display name, slug, category
- Import path
- Deprecated flag

### Signatures
- Parameters with names, types, optionality
- Return types
- Type parameters with constraints

### Members
- Class/interface members
- Visibility (public, protected, private)
- Member kind (method, property, accessor)

### Documentation
- Description
- Tags (@param, @returns, etc.)
- Examples
- Related references (@see)

---

## Commands

### Generate Pure OpenPkg Spec

```bash
# Generate structural API spec
doccov generate -o openpkg.json

# With filtering
doccov generate --include "Client*" --exclude "*Internal"
```

The output is a pure structural specification:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
  "openpkg": "0.3.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "createUser",
      "name": "createUser",
      "kind": "function",
      "description": "Creates a new user",
      "signatures": [...]
    }
  ]
}
```

### Get Coverage Data

For coverage analysis, use the `check` command:

```bash
# Check with text output
doccov check --min-coverage 80

# Generate coverage report (JSON)
doccov check --format json -o coverage.json

# Generate coverage report (Markdown)
doccov check --format markdown -o COVERAGE.md
```

### Programmatic Coverage

Use the SDK to compute coverage:

```typescript
import { DocCov, enrichSpec } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// Pure OpenPkg spec (no coverage)
console.log(spec.exports[0].docs); // undefined

// Enrich with coverage data
const enriched = enrichSpec(spec);
console.log(enriched.docs?.coverageScore); // 85
console.log(enriched.exports[0].docs?.missing); // ['examples']
```

---

## OpenPkg vs Enriched Spec

| Aspect | OpenPkg (Pure) | EnrichedOpenPkg |
|--------|----------------|-----------------|
| Purpose | Structural API description | Quality analysis |
| Output by | `doccov generate` | `enrichSpec()` or `doccov check --format json` |
| Coverage scores | No | Yes |
| Missing signals | No | Yes |
| Drift detection | No | Yes |
| Portability | Open standard, any tool | DocCov-specific |

---

## TODO

- [ ] Document full type definitions
- [ ] Add example output for each export kind
- [ ] Explain schema evolution process
- [ ] Document extension mechanism

