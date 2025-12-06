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
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const { spec, diagnostics } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Package: ${spec.meta.name}`);
console.log(`Coverage: ${spec.docs?.coverageScore}%`);
console.log(`Exports: ${spec.exports.length}`);
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
  spec: OpenPkg;           // Full OpenPkg spec
  diagnostics: Diagnostic[]; // TypeScript diagnostics
}
```

### Spec Structure

```typescript
spec.meta.name        // Package name
spec.meta.version     // Package version
spec.exports          // Array of exported items
spec.types            // Array of type definitions
spec.docs.coverageScore // Overall coverage %
```

### Accessing Exports

```typescript
for (const exp of spec.exports) {
  console.log(`${exp.name} (${exp.kind}): ${exp.docs?.coverageScore}%`);
  
  if (exp.docs?.drift?.length) {
    console.log(`  Drift issues: ${exp.docs.drift.length}`);
  }
}
```

### Checking Drift

```typescript
const driftExports = spec.exports.filter(e => 
  e.docs?.drift && e.docs.drift.length > 0
);

for (const exp of driftExports) {
  for (const drift of exp.docs.drift) {
    console.log(`${exp.name}: ${drift.issue}`);
    if (drift.suggestion) {
      console.log(`  Suggestion: ${drift.suggestion}`);
    }
  }
}
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
# Run SDK tests
bun test packages/sdk/test/

# Quick analysis
bun run -e "
  import { DocCov } from './packages/sdk/src';
  const dc = new DocCov();
  const r = await dc.analyzeFileWithDiagnostics('tests/fixtures/simple-math.ts');
  console.log(r.spec.docs);
"
```

## See Also

- [DocCov Class](./doccov-class.md) - Full class reference
- [Example Runner](./example-runner.md) - Execute examples
- [Filtering](./filtering.md) - Filter exports

