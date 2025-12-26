# Spec Generation (OpenPkg)

> Last updated: 2024-12-26

Deep dive into DocCov's OpenPkg specification generation.

---

## Overview

DocCov uses two separate specifications:

| Spec | Format | Purpose |
|------|--------|---------|
| **OpenPkg** | `openpkg.json` | Pure TypeScript API structure |
| **DocCov** | `doccov.json` | Coverage analysis & drift detection |

OpenPkg is a **pure structural format** - it captures what your package exports without quality metrics. The DocCov spec references OpenPkg and adds coverage scoring, missing doc rules, and drift analysis.

### Extraction Tools

| Tool | Package | Use Case |
|------|---------|----------|
| `doccov spec` | `@doccov/cli` | Within DocCov workflow |
| `tspec` | `@openpkg-ts/extract` | Standalone extraction |

---

## OpenPkg Format

### Version
Current: `0.4.0`

### Schema
JSON Schema published at: `packages/spec/schemas/v0.4.0/openpkg.schema.json`

### Structure

OpenPkg is a pure structural format:

```typescript
interface OpenPkg {
  $schema?: string;           // Schema reference
  openpkg: string;            // Version (e.g., "0.4.0")
  meta: OpenPkgMeta;          // Package metadata
  exports: SpecExport[];      // Public exports
  types?: SpecType[];         // Supporting type definitions
  examples?: SpecExample[];   // Global examples
  extensions?: SpecExtensions; // Custom extensions
  generation?: SpecGenerationMeta; // Generator info
}
```

> **Note**: Coverage data is stored in a separate `doccov.json` file using the DocCov spec (`@doccov/spec`), not in OpenPkg.

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
# Using doccov
doccov spec -o openpkg.json

# Using standalone tspec
tspec -o openpkg.json

# With filtering
doccov spec --include "Client*" --exclude "*Internal"
```

The output is a pure structural specification:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json",
  "openpkg": "0.4.0",
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
  ],
  "generation": {
    "generator": "@doccov/cli@0.21.0",
    "timestamp": "2024-12-26T10:00:00Z"
  }
}
```

### Get Coverage Data

For coverage analysis, use the `analyze` command:

```bash
# Analyze with threshold
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

## OpenPkg vs DocCov Spec

| Aspect | OpenPkg (`openpkg.json`) | DocCov (`doccov.json`) |
|--------|--------------------------|------------------------|
| Purpose | Structural API description | Quality analysis |
| Output by | `doccov spec` or `tspec` | `doccov check --format json` |
| Coverage scores | No | Yes |
| Missing doc rules | No | Yes |
| Drift detection | No | Yes |
| Portability | Open standard, tool-agnostic | DocCov-specific |
| Package | `@openpkg-ts/spec` | `@doccov/spec` |

### DocCov Spec Structure

```typescript
interface DocCovSpec {
  doccov: '0.1.0';
  source: {
    file: string;           // References openpkg.json
    specVersion: string;    // OpenPkg version used
    packageName: string;
  };
  summary: DocCovSummary;   // Aggregate scores
  exports: Record<string, ExportAnalysis>;
}
```

---

## TODO

- [ ] Document full type definitions
- [ ] Add example output for each export kind
- [ ] Explain schema evolution process
- [ ] Document extension mechanism

