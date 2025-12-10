# doccov check

Validate documentation coverage, detect drift, and generate coverage reports.

## Usage

```bash
doccov check [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--min-coverage <n>` | `80` | Minimum coverage percentage (0-100) |
| `--require-examples` | `false` | Require `@example` for every export |
| `--exec` | `false` | Execute `@example` blocks, fail on errors |
| `--ignore-drift` | `false` | Don't fail on documentation drift |
| `--skip-resolve` | `false` | Skip external type resolution from node_modules |
| `--fix` | `false` | Auto-fix drift issues |
| `--write` | `false` | Alias for `--fix` |
| `--dry-run` | `false` | Preview fixes without writing (requires `--fix`) |
| `--format <format>` | `text` | Output format: `text`, `json`, `markdown`, `html`, `github` |
| `-o, --output <file>` | - | Output file for non-text formats |
| `--update-snapshot` | `false` | Force regenerate `.doccov/report.json` |
| `--limit <n>` | `20` | Max exports to show in report tables |
| `--no-lint` | `false` | Skip lint checks |
| `--no-typecheck` | `false` | Skip example type checking |
| `-p, --package <name>` | - | Target package in monorepo |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Basic Check

```bash
doccov check
```

Fails if coverage < 80% or drift detected.

### Custom Threshold

```bash
doccov check --min-coverage 90
```

### Strict Mode

Require examples on all exports:

```bash
doccov check --require-examples
```

### Execute Examples

Run `@example` blocks and fail on runtime errors:

```bash
doccov check --exec
```

Requires Node.js 22+ (uses `--experimental-strip-types`).

**Package Pre-Install**: When `--exec` is used, the CLI automatically installs the local package in a temp directory before running examples. This means examples that import from your package work:

```typescript
/**
 * @example
 * import { add } from 'my-package';
 * console.log(add(1, 2)); // => 3
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

The CLI auto-detects your package manager (bun/pnpm/npm) from lockfiles.

#### Doctest Assertions

Add assertions to verify output using `// => expected` comments:

```typescript
/**
 * @example
 * console.log(add(1, 2)); // => 3
 * console.log(add(0, 0)); // => 0
 */
```

When examples run, stdout is compared line-by-line against assertions. Mismatches produce `example-assertion-failed` drift:

```
example-assertion-failed: expected "4" but got "3"
  Suggestion: Update assertion to: // => 3
```

Assertions are optional - examples without `// =>` comments only check for runtime errors.

**LLM Fallback**: If you have `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set, DocCov can detect non-standard assertion patterns like `// should be 5` or `// returns "hello"` and suggest converting them to standard `// =>` syntax.

### Ignore Drift

Pass even with drift issues:

```bash
doccov check --ignore-drift
```

### Auto-Fix Drift

Automatically fix drift issues:

```bash
doccov check --fix
```

Preview fixes without applying:

```bash
doccov check --fix --dry-run
```

Combine with threshold:

```bash
doccov check --min-coverage 80 --fix
```

When `--fix` is used:
1. Fixes are applied to source files
2. Fixed drifts are excluded from failure evaluation
3. Exit code reflects remaining issues after fixes

### Monorepo

Check specific package:

```bash
doccov check --package @myorg/core
```

### Combined

```bash
doccov check --min-coverage 95 --require-examples --exec
```

### Coverage Reports

Generate coverage reports in different formats:

```bash
# JSON report (includes coverage data)
doccov check --format json -o coverage.json

# Markdown report
doccov check --format markdown -o COVERAGE.md

# HTML report
doccov check --format html -o coverage.html

# GitHub Actions summary format
doccov check --format github
```

The JSON format outputs a `DocCovReport` with full coverage details:

```json
{
  "$schema": "https://doccov.dev/schemas/v1.0.0/report.schema.json",
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "spec": {
    "name": "my-package",
    "version": "1.0.0"
  },
  "coverage": {
    "score": 85,
    "totalExports": 20,
    "documentedExports": 17,
    "missingBySignal": {
      "description": 2,
      "params": 1,
      "returns": 0,
      "examples": 3
    },
    "driftCount": 1
  },
  "exports": {
    "createUser": {
      "name": "createUser",
      "kind": "function",
      "coverageScore": 75,
      "missing": ["examples"]
    }
  }
}
```

## Output

### Success

```
✓ Auto-detected entry point: src/index.ts
✓ Documentation analysis complete
✓ Docs coverage 92% (min 80%)
```

### Failure

```
✓ Auto-detected entry point: src/index.ts
✓ Documentation analysis complete

Docs coverage 65% fell below required 80%.

Missing documentation details:
  • createUser: missing params, examples
  • updateUser: param-mismatch: @param userId not in signature
    Suggestion: id
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - coverage met, no drift |
| 1 | Fail - coverage below threshold or drift detected |

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check docs coverage
  run: npx @doccov/cli check --min-coverage 80
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx doccov check --min-coverage 80
```

### package.json

```json
{
  "scripts": {
    "docs:check": "doccov check --min-coverage 80",
    "docs:strict": "doccov check --min-coverage 90 --require-examples"
  }
}
```

## Drift Detection

By default, `check` fails on any drift. Drift types detected:

| Type | Description |
|------|-------------|
| `param-mismatch` | `@param` doesn't match signature |
| `param-type-mismatch` | `@param {Type}` differs from actual |
| `return-type-mismatch` | `@returns {Type}` differs from actual |
| `optionality-mismatch` | `[param]` vs required param |
| `example-drift` | Example references missing export |
| `example-runtime-error` | Example throws (with `--run-examples`) |
| `example-assertion-failed` | `// => value` assertion doesn't match output |
| `broken-link` | `{@link X}` target not found |

See [Drift Types](../../spec/drift-types.md) for full list.

## Auto-Fixable Drift Types

The `--write` flag can automatically fix:

| Type | Fix Applied |
|------|-------------|
| `param-mismatch` | Remove stale `@param` tags, rename parameters |
| `param-type-mismatch` | Update `@param {type}` to match signature |
| `optionality-mismatch` | Add/remove `[param]` brackets for optional params |
| `return-type-mismatch` | Update `@returns {type}` to match signature |
| `generic-constraint-mismatch` | Update `@template T extends X` constraints |
| `example-assertion-failed` | Update `// => value` assertions to match output |
| `deprecated-mismatch` | Add/remove `@deprecated` tag |
| `async-mismatch` | Add/remove `@async` tag |

Non-fixable types (require manual intervention): `example-drift`, `example-syntax-error`, `example-runtime-error`, `broken-link`, `visibility-mismatch`.

## Local Testing

```bash
# Test passing fixture
bun run packages/cli/src/cli.ts check tests/fixtures/docs-coverage

# Test drift detection
bun run packages/cli/src/cli.ts check tests/fixtures/drift-param-mismatch
```

## See Also

- [generate](./generate.md) - Generate pure structural spec
- [Drift Types](../../spec/drift-types.md) - All drift detectors

