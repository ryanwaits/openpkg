# DocCov Capabilities Overview

> Last updated: 2024-12-08

Complete inventory of DocCov features with implementation references.

---

## 1. Spec Generation (OpenPkg)

DocCov analyzes TypeScript source and generates a structured specification in the OpenPkg format.

### What We Capture

| Data | Description | Source |
|------|-------------|--------|
| Exports | All public exports from entry point | `packages/sdk/src/analysis/spec-builder.ts` |
| Signatures | Function/method parameters and return types | `packages/spec/src/types.ts:SpecSignature` |
| Members | Class/interface members with visibility | `packages/spec/src/types.ts:SpecMember` |
| Type parameters | Generics with constraints and defaults | `packages/spec/src/types.ts:SpecTypeParam` |
| Heritage | extends/implements relationships | `packages/spec/src/types.ts:SpecExport.extends` |
| Decorators | Decorator metadata | `packages/spec/src/types.ts:SpecDecorator` |
| JSDoc/TSDoc | Parsed documentation comments | `packages/sdk/src/utils/tsdoc-parser.ts` |
| Source locations | File paths and line numbers | `packages/spec/src/types.ts:SpecSource` |
| Coverage metadata | Scores, missing signals, drift | `packages/spec/src/types.ts:SpecDocsMetadata` |

### Export Kinds

```typescript
type SpecExportKind =
  | 'function'    // Function declarations
  | 'class'       // Class declarations
  | 'variable'    // Constants and variables
  | 'interface'   // TypeScript interfaces
  | 'type'        // Type aliases
  | 'enum'        // Enum declarations
  | 'module'      // Module declarations
  | 'namespace'   // Namespace declarations
  | 'reference'   // Re-exports
  | 'external'    // External types
```

### Commands

```bash
# Generate pure OpenPkg spec (JSON)
doccov spec -o openpkg.json

# Generate coverage report
doccov check --format json -o coverage.json
```

---

## 2. Report Generation

### Output Formats

| Format | Command | Use Case |
|--------|---------|----------|
| JSON | `--format json` | Programmatic consumption, CI pipelines |
| Markdown | `--format markdown` | README badges, documentation |
| HTML | `--format html` | Sharing, dashboards |
| GitHub | `--format github` | PR annotations, Actions logs |
| Text | (default) | CLI usage, local development |

### Report Contents

- Coverage score (0-100%)
- Signal-level breakdown (description, params, returns, examples)
- Export kind distribution with average scores
- Lowest coverage exports
- Drift issue inventory
- Missing documentation list

**Source**: `packages/cli/src/reports/`

---

## 3. Coverage Scoring

DocCov calculates documentation coverage as a percentage (0-100%).

### How It Works

Each export kind has applicable "signals":

| Export Kind | Applicable Signals |
|-------------|-------------------|
| function | description, params, returns, examples |
| class | description, examples |
| interface | description |
| type | description |
| variable | description |
| enum | description |

Coverage = (signals present / signals applicable) × 100

### Per-Export Coverage

```typescript
interface SpecDocsMetadata {
  coverageScore?: number;        // 0-100
  missing?: SpecDocSignal[];     // ['params', 'examples']
  drift?: SpecDocDrift[];        // List of issues
}
```

### Thresholds

```bash
# Fail if coverage < 80%
doccov check --min-coverage 80
```

**Source**: `packages/sdk/src/analysis/docs-coverage.ts`

---

## 4. Drift Detection

DocCov detects 14 types of documentation drift (mismatches between docs and code).

### Drift Types

| Type | Description | Auto-Fixable |
|------|-------------|:------------:|
| `param-mismatch` | `@param userId` but signature has `id` | Yes |
| `param-type-mismatch` | `@param {string} count` but type is `number` | Yes |
| `return-type-mismatch` | `@returns {User}` but returns `Promise<User>` | Yes |
| `optionality-mismatch` | `[param]` but param is required | Yes |
| `deprecated-mismatch` | `@deprecated` without matching code flag | Yes |
| `async-mismatch` | Missing `@async` on Promise-returning function | Yes |
| `visibility-mismatch` | `@internal` but export is public | Yes |
| `property-type-drift` | `@type` doesn't match declaration | Yes |
| `generic-constraint-mismatch` | Wrong `@template` constraint | Yes |
| `example-drift` | Example references deleted/renamed export | No |
| `example-syntax-error` | Example has TypeScript syntax errors | No |
| `example-runtime-error` | Example throws at runtime | No |
| `example-assertion-failed` | `// => expected` doesn't match actual | Yes |
| `broken-link` | `{@link Foo}` but `Foo` not found | No |

### Detection

```bash
# Check for drift (included in standard analysis)
doccov check
```

### Drift Output

```typescript
interface SpecDocDrift {
  type: DriftType;
  target?: string;      // e.g., parameter name
  issue: string;        // Human-readable explanation
  suggestion?: string;  // How to fix
}
```

**Source**: `packages/sdk/src/analysis/docs-coverage.ts`

---

## 5. Auto-Fix

DocCov can automatically repair many drift issues.

### Fixable Issues

- Missing `@param` tags (generated from signature)
- Wrong param types (updated from signature)
- Missing `@returns` tag
- Optionality mismatches
- Deprecated flag mismatches
- Visibility mismatches

### Commands

```bash
# Auto-fix drift issues
doccov check --fix

# Preview fixes without applying
doccov check --fix --dry-run
```

### Example Output

```
Found 3 fixable issue(s)

  src/client.ts:
    ✓ ChainhooksClient.createChainhook [line 45]
      + Update @param options type to {CreateOptions}
      + Add missing @param timeout
```

**Source**: `packages/sdk/src/fix/`, `packages/cli/src/commands/analyze.ts`

---

## 6. Example Validation

DocCov validates `@example` blocks in three ways.

### Type-Checking

```bash
doccov check --examples types
```

Compiles example code against actual TypeScript signatures. Catches type errors before runtime.

### Runtime Execution

```bash
doccov check --examples run
```

Actually runs examples using Node.js with `--experimental-strip-types`. Catches runtime errors.

### Inline Assertions

```typescript
/**
 * @example
 * console.log(add(2, 3)); // => 5
 */
export function add(a: number, b: number) {
  return a + b;
}
```

DocCov validates that `// => 5` matches actual stdout.

### Require Examples

```bash
# Fail if any export lacks @example
doccov check --examples presence
```

**Source**: `packages/sdk/src/utils/example-runner.ts`, `packages/sdk/src/typecheck/`

---

## 7. Diff & Breaking Change Detection

Compare two specs and detect API changes.

### Change Categories

| Category | Description |
|----------|-------------|
| `breaking` | Removed or incompatibly changed exports |
| `nonBreaking` | New exports added |
| `docsOnly` | Documentation-only changes |

### Severity Levels

| Severity | Examples |
|----------|----------|
| `high` | Function/class removed, constructor changed, method removed |
| `medium` | Interface/type changed, signature modified |
| `low` | Variable changed, other modifications |

### Member-Level Tracking

For classes, DocCov tracks individual member changes:

```typescript
interface MemberChangeInfo {
  className: string;
  memberName: string;
  memberKind: 'method' | 'property' | 'accessor' | 'constructor';
  changeType: 'added' | 'removed' | 'signature-changed';
  oldSignature?: string;
  newSignature?: string;
  suggestion?: string;
}
```

### Commands

```bash
# Compare two specs
doccov diff base.json head.json

# Output formats
doccov diff base.json head.json --format json
doccov diff base.json head.json --format github
doccov diff base.json head.json --format report
```

### Diff Output

```typescript
interface SpecDiff {
  breaking: string[];
  nonBreaking: string[];
  docsOnly: string[];
  coverageDelta: number;
  oldCoverage: number;
  newCoverage: number;
  newUndocumented: string[];
  improvedExports: string[];
  regressedExports: string[];
  driftIntroduced: number;
  driftResolved: number;
}
```

**Source**: `packages/spec/src/diff.ts`, `packages/cli/src/commands/diff.ts`

---

## 8. External Documentation Impact

Scan markdown files and identify which docs are affected by API changes.

### How It Works

1. Parse markdown files and extract code blocks
2. Identify API references (imports, function calls, class instantiation)
3. Cross-reference with spec changes
4. Report impacted files with line numbers

### Commands

```bash
# Include docs scanning in diff
doccov diff base.json head.json --docs "docs/**/*.md"

# Or configure in doccov.config.ts
export default defineConfig({
  docs: {
    include: ['docs/**/*.md', 'README.md'],
  },
});
```

### Output

```
Docs Requiring Updates
  Scanned 15 files, 42 code blocks

  evaluate.mdx (2 issues)
    L30: evaluateChainhook() → Use replayChainhook instead
    L44: evaluateChainhook() → Use replayChainhook instead

  5 file(s) with class instantiation to review:
    migration.mdx, update.mdx, ...
```

**Source**: `packages/sdk/src/markdown/`

---

## 9. Linting

Pluggable documentation linting rules.

### Built-in Rules

| Rule | Description |
|------|-------------|
| `require-description` | Every export needs a description |
| `require-example` | Every export needs an `@example` |
| `no-empty-returns` | `@returns` must have description |
| `consistent-param-style` | All @param tags must use same format |

### Commands

```bash
doccov check
```

Lint checks are run by default. Skip them with `--ignore-lint`.

**Source**: `packages/sdk/src/lint/rules/`

---

## 10. CI/CD Integration

### Strict Modes

```bash
doccov diff base.json head.json --strict <options>
```

| Mode | Fails When |
|------|------------|
| `regression` | Coverage decreased |
| `drift` | New drift issues introduced |
| `docs-impact` | External docs need updates |
| `breaking` | Any breaking changes detected |
| `undocumented` | New exports lack documentation |
| `all` | Any of the above |

### GitHub Annotations

```bash
doccov diff base.json head.json --format github
```

Output:
```
::warning file=docs/evaluate.mdx,line=30,title=API Change::evaluateChainhook() removed
::error title=Breaking Change::legacyFetch - removed
::notice title=Missing Documentation::New export deleteUser needs documentation
```

These appear inline in PR diffs.

**Source**: `packages/cli/src/commands/diff.ts`

---

## 11. Remote Repository Scanning

Analyze any public GitHub repository.

```bash
doccov scan https://github.com/org/repo --package @scope/package
```

Features:
- Auto-detects entry points from package.json
- Installs dependencies
- Runs full analysis
- Outputs coverage report

**Source**: `packages/sdk/src/scan/orchestrator.ts`

---

## 12. Release Tags & Visibility

### Supported Tags

| Tag | Parsed | Visibility Mapping |
|-----|:------:|-------------------|
| `@internal` | Yes | internal |
| `@alpha` | Yes | internal |
| `@beta` | Yes | (parsed, no special handling yet) |
| `@public` | Yes | public |
| `@private` | Yes | private |
| `@protected` | Yes | protected |

### Visibility Drift Detection

DocCov detects when JSDoc visibility tags don't match code:

```typescript
// @internal tag but export is public
export function internalHelper() {} // drift: visibility-mismatch
```

**Source**: `packages/sdk/src/analysis/docs-coverage.ts`

---

## 13. Configuration

### Config File

```typescript
// doccov.config.ts
import { defineConfig } from '@doccov/cli';

export default defineConfig({
  // Entry point (auto-detected if not specified)
  entry: 'src/index.ts',

  // External docs to scan
  docs: {
    include: ['docs/**/*.md', 'README.md'],
    exclude: ['docs/archive/**'],
  },

  // Export filtering
  filters: {
    include: ['public*'],
    exclude: ['_internal*', '*Test'],
  },

  // Coverage thresholds
  coverage: {
    minimum: 80,
  },

  // Lint rules
  lint: {
    rules: {
      'require-description': 'error',
      'require-example': 'warn',
    },
  },
});
```

**Source**: `packages/cli/src/config/`

---

## 14. OpenPkg Specification

DocCov outputs the OpenPkg format - an open standard for TypeScript API specifications.

### Key Properties

- **Open**: Published JSON Schema
- **Self-contained**: No external references
- **Portable**: Tool-agnostic
- **Versioned**: Currently v0.3.0

### Schema Location

`packages/spec/schemas/v0.3.0/openpkg.schema.json`

### Validation

```typescript
import { validateSpec } from '@openpkg-ts/spec';

const result = validateSpec(spec);
if (!result.valid) {
  console.error(result.errors);
}
```

**Source**: `packages/spec/`

---

## 15. API Reference Site Generation

DocCov provides a complete solution for rendering API reference documentation.

### Packages

| Package | Purpose |
|---------|---------|
| `@doccov/fumadocs-adapter` | React components for Fumadocs integration |
| `@doccov/ui` | Shared UI component library (50+ components) |

### Page Components

| Component | Description |
|-----------|-------------|
| `APIPage` | Route dispatcher for all export types |
| `FunctionPage` | Function docs with params, returns, examples |
| `ClassPage` | Class docs with methods, properties, constructor |
| `InterfacePage` | Interface/type docs with members |
| `EnumPage` | Enum docs with member values |
| `VariablePage` | Const/variable documentation |

### Shared Components

| Component | Description |
|-----------|-------------|
| `Signature` | TypeScript signature with generics |
| `TypeTable` | Parameter/property tables |
| `ParameterCard` | Visual parameter documentation |
| `CodeExample` | Syntax-highlighted examples |
| `CoverageBadge` | Coverage score with missing signals |
| `CollapsibleMethod` | Accordion UI for methods |

### Key Differentiators

- **Coverage badges on every page** - See at a glance what's missing
- **Drift indicators** - Know when docs don't match code
- **Collapsible method sections** - Better UX for large classes
- **Two-column layouts** - Examples alongside parameters
- **Interactive code** - CodeHike-powered syntax highlighting
- **Framework integration** - Lives in your existing Fumadocs site

### Quick Setup

```tsx
// 1. Load spec
import { createOpenPkg } from '@doccov/fumadocs-adapter/server';
const openpkg = createOpenPkg('./openpkg.json');

// 2. Create route
import { APIPage } from '@doccov/fumadocs-adapter';

export default function Page({ params }) {
  const exp = openpkg.getExport(params.slug);
  return <APIPage export={exp} />;
}
```

**Source**: `packages/fumadocs-adapter/`, `packages/ui/`

See: [Doc Site Generation](./doc-site-generation.md) for full details.
