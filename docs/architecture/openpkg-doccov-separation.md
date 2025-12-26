# OpenPkg & DocCov Separation

Two-spec architecture for TypeScript API documentation.

## Overview

DocCov uses two separate specifications:

```
TypeScript Source
       │
       ▼
┌──────────────┐
│    tspec     │  @openpkg-ts/extract
│   (or doccov │
│     spec)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ openpkg.json │  Pure API structure
│   (v0.4.0)   │  @openpkg-ts/spec
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   DocCov     │  @doccov/cli, @doccov/sdk
│   Analysis   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ doccov.json  │  Coverage & drift analysis
│   (v0.1.0)   │  @doccov/spec
└──────────────┘
```

## Why Separation?

### Single Responsibility

| Spec | Concern |
|------|---------|
| OpenPkg | "What does this API look like?" |
| DocCov | "How well is it documented?" |

### Portability

OpenPkg is **tool-agnostic**. Other tools can consume `openpkg.json`:
- Documentation generators
- API comparison tools
- Code editors
- Type validators

DocCov spec is **DocCov-specific**. It references OpenPkg and adds quality metrics.

### Versioning

Each spec evolves independently:
- OpenPkg: structural changes, new export kinds
- DocCov: new drift types, scoring algorithms

## Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@openpkg-ts/spec` | 0.4.0 | OpenPkg types, validation, diffing |
| `@openpkg-ts/extract` | 0.1.0 | `tspec` CLI for extraction |
| `@doccov/spec` | 0.1.0 | DocCov types, drift categories |

## File Formats

### openpkg.json (OpenPkg v0.4.0)

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
      "description": "Creates a user",
      "signatures": [...]
    }
  ],
  "types": [...],
  "generation": {
    "generator": "@doccov/cli@0.21.0",
    "timestamp": "2024-12-26T10:00:00Z"
  }
}
```

### doccov.json (DocCov v0.1.0)

```json
{
  "$schema": "https://doccov.dev/schemas/v0.1.0/doccov.schema.json",
  "doccov": "0.1.0",
  "source": {
    "file": "openpkg.json",
    "specVersion": "0.4.0",
    "packageName": "my-package"
  },
  "generatedAt": "2024-12-26T10:00:00Z",
  "summary": {
    "score": 85,
    "totalExports": 10,
    "documentedExports": 8,
    "missingByRule": {
      "description": 0,
      "params": 1,
      "returns": 1,
      "examples": 5,
      "throws": 3
    },
    "drift": {
      "total": 2,
      "fixable": 2,
      "byCategory": {
        "structural": 2,
        "semantic": 0,
        "example": 0
      }
    }
  },
  "exports": {
    "createUser": {
      "coverageScore": 100,
      "missing": [],
      "drift": []
    }
  }
}
```

## Workflows

### Generate Both Specs

```bash
# Step 1: Extract API structure
doccov spec -o openpkg.json

# Step 2: Analyze coverage
doccov check --format json -o doccov.json
```

### Standalone Extraction

```bash
# Just need openpkg.json (no DocCov)
tspec -o openpkg.json
```

### CI Integration

```bash
# Full pipeline
doccov spec
doccov check --min-coverage 80 --max-drift 0
```

## Migration

If upgrading from older DocCov versions that embedded coverage in OpenPkg:

1. **Before**: `openpkg.json` with `docs.coverageScore` fields
2. **After**: Pure `openpkg.json` + separate `doccov.json`

The `enrichSpec()` SDK function still works for in-memory enrichment, but file output is now separated.
