# `analyzeProject()`: Multi-file SDK Analysis Function

**Priority:** P7
**Phase:** 10F
**Labels:** `enhancement`, `sdk`

## Summary

Add an `analyzeProject()` function to the SDK for analyzing multiple files, entire directories, and monorepos programmatically. Currently `analyze()` takes a single entry point - this enables batch analysis.

## Proposed API

```typescript
import { analyzeProject } from '@doccov/sdk';

// Analyze entire project
const result = await analyzeProject({
  root: './packages/sdk',
  include: ['src/**/*.ts'],
  exclude: ['**/*.test.ts', '**/__tests__/**'],
});

// Access aggregate stats
console.log(result.aggregateCoverage); // 87
console.log(result.totalExports);       // 142
console.log(result.documentedExports);  // 124

// Per-file breakdown
for (const file of result.files) {
  console.log(`${file.path}: ${file.coverage}% (${file.exports.length} exports)`);
}

// Monorepo analysis
const monoResult = await analyzeProject({
  root: '.',
  packages: ['packages/*'],  // Glob for package directories
});

for (const pkg of monoResult.packages) {
  console.log(`${pkg.name}: ${pkg.coverage}%`);
}
```

## Types

```typescript
// packages/sdk/src/project/types.ts

export interface AnalyzeProjectOptions {
  /** Root directory to analyze */
  root: string;

  /** Glob patterns for files to include */
  include?: string[];

  /** Glob patterns for files to exclude */
  exclude?: string[];

  /** For monorepos: glob patterns for package directories */
  packages?: string[];

  /** Run example code blocks */
  runExamples?: boolean;

  /** TypeScript config path (auto-detected if not provided) */
  tsconfig?: string;
}

export interface ProjectAnalysisResult {
  /** Aggregate coverage across all files */
  aggregateCoverage: number;

  /** Total number of exports found */
  totalExports: number;

  /** Number of documented exports */
  documentedExports: number;

  /** Total drift issues across all files */
  totalDrift: number;

  /** Per-file results */
  files: FileAnalysisResult[];

  /** For monorepos: per-package results */
  packages?: PackageAnalysisResult[];
}

export interface FileAnalysisResult {
  path: string;
  coverage: number;
  exports: SpecExport[];
  drift: SpecDocDrift[];
}

export interface PackageAnalysisResult {
  name: string;
  path: string;
  coverage: number;
  files: FileAnalysisResult[];
}
```

## Implementation Details

### File Discovery

```typescript
// Use fast-glob for file matching
import fg from 'fast-glob';

const files = await fg(include, {
  cwd: root,
  ignore: exclude,
  absolute: true,
});
```

### Coverage Aggregation

```typescript
function aggregateCoverage(files: FileAnalysisResult[]): number {
  const totalExports = files.reduce((sum, f) => sum + f.exports.length, 0);
  const totalScore = files.reduce(
    (sum, f) => sum + f.exports.reduce((s, e) => s + (e.docs?.coverageScore ?? 0), 0),
    0
  );
  return totalExports > 0 ? Math.round(totalScore / totalExports) : 100;
}
```

### Monorepo Detection

```typescript
function detectMonorepoPackages(root: string): string[] {
  // Check pnpm-workspace.yaml
  const pnpmWorkspace = path.join(root, 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspace)) {
    const content = yaml.parse(fs.readFileSync(pnpmWorkspace, 'utf-8'));
    return content.packages || [];
  }

  // Check package.json workspaces
  const pkgJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  if (pkgJson.workspaces) {
    return Array.isArray(pkgJson.workspaces)
      ? pkgJson.workspaces
      : pkgJson.workspaces.packages || [];
  }

  // Check lerna.json
  const lernaJson = path.join(root, 'lerna.json');
  if (fs.existsSync(lernaJson)) {
    const content = JSON.parse(fs.readFileSync(lernaJson, 'utf-8'));
    return content.packages || ['packages/*'];
  }

  return [];
}
```

## Use Cases

1. **CI Integration**: Analyze entire repo in one call, get aggregate stats
2. **Monorepo Reports**: Per-package coverage breakdown
3. **IDE Plugins**: Background analysis of project for real-time coverage display
4. **Custom Tooling**: Build dashboards, reports, or integrations on top

## Acceptance Criteria

- [ ] `analyzeProject()` function exported from SDK
- [ ] Glob pattern support for include/exclude
- [ ] Aggregate coverage calculation across files
- [ ] Per-file breakdown with exports and drift
- [ ] Monorepo detection and per-package analysis
- [ ] TypeScript config auto-detection
- [ ] Performance: parallel file analysis where possible
- [ ] Documentation in SDK README
