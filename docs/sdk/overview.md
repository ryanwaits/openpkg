# SDK Overview

The `@doccov/sdk` package provides programmatic access to TypeScript documentation analysis.

## Installation

```bash
npm install @doccov/sdk
```

## Exports

```typescript
import {
  // Main class
  DocCov,
  OpenPkg,  // Alias for DocCov

  // Analysis functions
  analyze,
  analyzeFile,

  // Coverage enrichment (new in 0.3.0)
  enrichSpec,
  generateReport,
  type EnrichedOpenPkg,
  type EnrichedExport,
  type DocCovReport,

  // Example execution
  runExample,
  runExamples,
  detectExampleRuntimeErrors,

  // Extractor
  extractPackageSpec,

  // Project detection
  detectMonorepo,
  detectPackageManager,
  detectEntryPoint,
  resolveTarget,
  NodeFileSystem,
  SandboxFileSystem,

  // GitHub utilities
  parseGitHubUrl,
  fetchSpecFromGitHub,

  // Scan utilities
  extractSpecSummary,

  // Config
  defineConfig,

  // Types
  type DocCovOptions,
  type OpenPkgOptions,
  type AnalysisResult,
  type AnalyzeOptions,
  type Diagnostic,
  type FilterOptions,
  type ScanResult,
  type DocCovConfig,
  type RunExampleOptions,
  type ExampleRunResult,
  type OpenPkgSpec,
} from '@doccov/sdk';
```

## Quick Start

```typescript
import { DocCov, enrichSpec } from '@doccov/sdk';

const doccov = new DocCov();
const { spec, diagnostics } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// spec is a pure structural OpenPkg (no coverage data)
console.log(`Package: ${spec.meta.name}`);
console.log(`Exports: ${spec.exports.length}`);

// Enrich with coverage data
const enriched = enrichSpec(spec);
console.log(`Coverage: ${enriched.docs?.coverageScore}%`);
```

## Core Components

### DocCov Class

Main analysis class. Handles TypeScript parsing, coverage calculation, and drift detection.

```typescript
const doccov = new DocCov({
  resolveExternalTypes: true,  // Resolve types from node_modules
});
```

See [DocCov Class](./doccov-class.md).

### Example Runner

Execute `@example` code blocks to validate they work.

```typescript
import { runExamples, detectExampleRuntimeErrors } from '@doccov/sdk';

const results = await runExamples(examples, { timeout: 5000 });
const drifts = detectExampleRuntimeErrors(exportEntry, results);
```

See [Example Runner](./example-runner.md).

### Filtering

Include/exclude exports by name pattern.

```typescript
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['create*', 'update*'],
    exclude: ['_internal*'],
  },
});
```

See [Filtering](./filtering.md).

## Analysis Result

```typescript
interface AnalysisResult {
  spec: OpenPkg;           // Pure structural spec (no coverage data)
  diagnostics: Diagnostic[]; // TypeScript diagnostics
}
```

### Pure Spec Structure

The analyzed `spec` is a pure structural format without coverage metadata:

```typescript
spec.meta.name        // Package name
spec.meta.version     // Package version
spec.exports          // Array of exported items
spec.types            // Array of type definitions
// Note: spec.docs does NOT exist on pure OpenPkg
```

### Enriching with Coverage Data

Use `enrichSpec()` to add coverage scores, missing signals, and drift detection:

```typescript
import { enrichSpec } from '@doccov/sdk';

const enriched = enrichSpec(spec);

// Now you have coverage data
enriched.docs?.coverageScore  // Overall coverage %
enriched.exports[0].docs?.coverageScore  // Per-export coverage
enriched.exports[0].docs?.missing  // ['description', 'examples']
enriched.exports[0].docs?.drift  // Drift issues array
```

### Accessing Enriched Exports

```typescript
const enriched = enrichSpec(spec);

for (const exp of enriched.exports) {
  console.log(`${exp.name} (${exp.kind}): ${exp.docs?.coverageScore}%`);

  if (exp.docs?.drift?.length) {
    console.log(`  Drift issues: ${exp.docs.drift.length}`);
  }
}
```

### Checking Drift

```typescript
const enriched = enrichSpec(spec);
const driftExports = enriched.exports.filter(e =>
  e.docs?.drift && e.docs.drift.length > 0
);

for (const exp of driftExports) {
  for (const drift of exp.docs!.drift!) {
    console.log(`${exp.name}: ${drift.issue}`);
    if (drift.suggestion) {
      console.log(`  Suggestion: ${drift.suggestion}`);
    }
  }
}
```

### Generating Reports

Generate a persistable coverage report:

```typescript
import { generateReport, saveReport } from '@doccov/sdk';

const report = generateReport(spec);
saveReport(report);  // Saves to .doccov/report.json

console.log(`Coverage: ${report.coverage.score}%`);
console.log(`Documented: ${report.coverage.documentedExports}/${report.coverage.totalExports}`);
```

## Standalone Functions

### analyze()

Analyze in-memory source:

```typescript
import { analyze } from '@doccov/sdk';

const spec = analyze(sourceCode, 'module.ts');
```

### analyzeFile()

Analyze a file:

```typescript
import { analyzeFile } from '@doccov/sdk';

const spec = await analyzeFile('src/index.ts');
```

## TypeScript Configuration

DocCov reads `tsconfig.json` from the analyzed file's directory.

## Local Testing

```bash
# Quick analysis
bun run -e "
  import { DocCov, enrichSpec } from './packages/sdk/src';
  const dc = new DocCov();
  const r = await dc.analyzeFileWithDiagnostics('src/index.ts');
  const enriched = enrichSpec(r.spec);
  console.log(enriched.docs);
"
```

## See Also

- [DocCov Class](./doccov-class.md) - Full class reference
- [Example Runner](./example-runner.md) - Execute examples
- [Filtering](./filtering.md) - Filter exports

