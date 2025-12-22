# SDK Overview

`@doccov/sdk` - Programmatic API for TypeScript documentation coverage analysis.

## Installation

```bash
npm install @doccov/sdk
```

## Quick Start

```typescript
import { DocCov, enrichSpec, generateReport } from '@doccov/sdk';

// 1. Analyze
const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// 2. Enrich with coverage data
const enriched = await enrichSpec(result.spec);

// 3. Generate report
const report = generateReport(enriched);
console.log(`Coverage: ${report.coverage.score}%`);
```

## Core Exports

### Analysis

| Export | Description |
|--------|-------------|
| `DocCov` | Main analysis class |
| `analyze` | Quick analysis (code string) |
| `analyzeFile` | Analyze single file |
| `enrichSpec` | Add coverage metadata |
| `generateReport` | Create coverage report |

### Drift & Coverage

| Export | Description |
|--------|-------------|
| `computeDrift` | Detect documentation drift |
| `computeExportDrift` | Drift for single export |
| `categorizeDrift` | Group by category |
| `getDriftSummary` | Drift statistics |

### Quality

| Export | Description |
|--------|-------------|
| `evaluateExportQuality` | Check export against rules |
| `CORE_RULES` | Coverage-affecting rules |
| `TSDOC_RULES` | TSDoc compliance rules |

### Validation

| Export | Description |
|--------|-------------|
| `validateExamples` | Run example validation |

### Utilities

| Export | Description |
|--------|-------------|
| `defineConfig` | Type-safe config helper |
| `parseGitHubUrl` | Parse GitHub URLs |
| `fetchSpec` | Fetch spec from GitHub |
| `diffSpecWithDocs` | Compare specs with docs |

## Modules

- [Analysis](./analysis.md) - DocCov class & pipeline
- [Filtering](./filtering.md) - Export filtering
- [Quality Rules](./quality-rules.md) - Rule engine
- [Drift Detection](./drift-detection.md) - Drift types
- [Example Validation](./example-validation.md) - Example testing

## Types

Re-exports from `@openpkg-ts/spec`:

```typescript
import type {
  OpenPkg,
  SpecExport,
  SpecType,
  SpecSignature,
  SpecDocDrift,
  DriftType,
} from '@doccov/sdk';
```
