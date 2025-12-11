# DocCov Class

The main class for analyzing TypeScript documentation.

## Import

```typescript
import { DocCov } from '@doccov/sdk';
// or
import { OpenPkg } from '@doccov/sdk'; // Alias
```

## Constructor

```typescript
const doccov = new DocCov(options?: DocCovOptions);
```

### Options

```typescript
interface DocCovOptions {
  resolveExternalTypes?: boolean;  // Default: true
  useCache?: boolean;              // Default: true
  cwd?: string;                    // Default: process.cwd()
  maxDepth?: number;               // Default: 20
  includePrivate?: boolean;        // Default: false
  followImports?: boolean;         // Default: true
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `resolveExternalTypes` | `true` | Resolve types from `node_modules` |
| `useCache` | `true` | Enable spec caching for faster subsequent runs |
| `cwd` | `process.cwd()` | Working directory for cache operations |
| `maxDepth` | `20` | Maximum depth for type conversion |
| `includePrivate` | `false` | Include private exports in analysis |
| `followImports` | `true` | Follow and analyze imports |

## Methods

### analyzeFileWithDiagnostics()

Analyze a TypeScript file and return spec with diagnostics.

```typescript
const result = await doccov.analyzeFileWithDiagnostics(
  filePath: string,
  options?: AnalyzeOptions
): Promise<AnalysisResult>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `filePath` | `string` | Path to TypeScript entry file |
| `options` | `AnalyzeOptions` | Optional analysis options |

#### AnalyzeOptions

```typescript
interface AnalyzeOptions {
  filters?: FilterOptions;
}

interface FilterOptions {
  include?: string[];  // Glob patterns to include
  exclude?: string[];  // Glob patterns to exclude
}
```

#### Returns

```typescript
interface AnalysisResult {
  spec: OpenPkg;
  diagnostics: Diagnostic[];
  metadata: AnalysisMetadata;
  fromCache?: boolean;           // True if result came from cache
  cacheStatus?: CacheValidationResult;
}

interface AnalysisMetadata {
  baseDir: string;
  configPath?: string;
  packageJsonPath?: string;
  hasNodeModules: boolean;
  resolveExternalTypes: boolean;
  sourceFiles?: string[];
}

interface Diagnostic {
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
}
```

## Examples

### Basic Analysis

```typescript
import { DocCov, enrichSpec } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

// spec is pure structural - enrich to get coverage data
const enriched = enrichSpec(spec);
console.log(`Coverage: ${enriched.docs?.coverageScore}%`);
```

### With Filters

```typescript
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['create*', 'update*', 'delete*'],
    exclude: ['_*', '*Internal'],
  },
});
```

### Skip External Types

Faster analysis, but loses external type info:

```typescript
const doccov = new DocCov({ resolveExternalTypes: false });
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
```

### Disable Caching

Force fresh analysis every time:

```typescript
const doccov = new DocCov({ useCache: false });
const { spec, fromCache } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
console.log(`From cache: ${fromCache}`);  // Always false
```

### Check Cache Status

```typescript
const doccov = new DocCov();
const result = await doccov.analyzeFileWithDiagnostics('src/index.ts');

if (result.fromCache) {
  console.log('Using cached spec (no source changes detected)');
} else {
  console.log('Fresh analysis performed');
}
```

### Check for Errors

```typescript
const { spec, diagnostics } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

const errors = diagnostics.filter(d => d.severity === 'error');
if (errors.length > 0) {
  console.log('TypeScript errors:');
  for (const e of errors) {
    console.log(`  ${e.file}:${e.line} - ${e.message}`);
  }
}
```

### Iterate Exports

```typescript
import { DocCov, enrichSpec } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
const enriched = enrichSpec(spec);

for (const exp of enriched.exports) {
  const coverage = exp.docs?.coverageScore ?? 0;
  const missing = exp.docs?.missing ?? [];
  const drift = exp.docs?.drift ?? [];

  console.log(`${exp.name}:`);
  console.log(`  Kind: ${exp.kind}`);
  console.log(`  Coverage: ${coverage}%`);

  if (missing.length > 0) {
    console.log(`  Missing: ${missing.join(', ')}`);
  }

  if (drift.length > 0) {
    console.log(`  Drift: ${drift.map(d => d.type).join(', ')}`);
  }
}
```

### Filter by Kind

```typescript
const functions = spec.exports.filter(e => e.kind === 'function');
const classes = spec.exports.filter(e => e.kind === 'class');
const interfaces = spec.exports.filter(e => e.kind === 'interface');

console.log(`Functions: ${functions.length}`);
console.log(`Classes: ${classes.length}`);
console.log(`Interfaces: ${interfaces.length}`);
```

### Find Undocumented Exports

```typescript
const enriched = enrichSpec(spec);
const undocumented = enriched.exports.filter(e =>
  (e.docs?.coverageScore ?? 0) < 100
);

console.log('Needs documentation:');
for (const exp of undocumented) {
  console.log(`  ${exp.name}: ${exp.docs?.missing?.join(', ')}`);
}
```

### Find Drift Issues

```typescript
const enriched = enrichSpec(spec);
const withDrift = enriched.exports.filter(e =>
  e.docs?.drift && e.docs.drift.length > 0
);

console.log('Has drift:');
for (const exp of withDrift) {
  for (const d of exp.docs!.drift!) {
    console.log(`  ${exp.name}: ${d.issue}`);
    if (d.suggestion) {
      console.log(`    Suggestion: ${d.suggestion}`);
    }
  }
}
```

## Caching

DocCov caches analysis results to speed up subsequent runs. The cache is stored in `.doccov/spec-cache.json`.

### How Caching Works

1. On first run, DocCov performs full analysis and saves the result
2. On subsequent runs, it checks if source files have changed
3. If no changes detected, returns cached spec instantly
4. If changes detected, performs fresh analysis and updates cache

### Cache Invalidation

The cache is automatically invalidated when:

- Source files are modified
- `tsconfig.json` changes
- `package.json` changes
- `resolveExternalTypes` option changes

### Disabling Cache

```typescript
// Per-instance
const doccov = new DocCov({ useCache: false });

// Or check if result was cached
const { spec, fromCache } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
```

## TypeScript Resolution

DocCov automatically:

1. Reads `tsconfig.json` from the entry file's directory
2. Resolves imports and type references
3. Follows re-exports and barrel files
4. Optionally resolves `node_modules` types

## Error Handling

```typescript
try {
  const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');
} catch (error) {
  if (error instanceof Error) {
    console.error('Analysis failed:', error.message);
  }
}
```

Common errors:
- File not found
- Invalid TypeScript
- Missing tsconfig.json
- Circular dependency issues

## Local Testing

```bash
# Quick test
bun run -e "
  import { DocCov, enrichSpec } from './packages/sdk/src';
  const dc = new DocCov();
  const r = await dc.analyzeFileWithDiagnostics('src/index.ts');
  const enriched = enrichSpec(r.spec);
  console.log(JSON.stringify(enriched.docs, null, 2));
"
```

## See Also

- [SDK Overview](./overview.md) - Package exports
- [Filtering](./filtering.md) - Filter patterns
- [Example Runner](./example-runner.md) - Execute examples

