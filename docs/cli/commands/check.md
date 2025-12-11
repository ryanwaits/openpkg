# doccov check

Check documentation coverage, detect drift, run lint checks, and generate coverage reports.

## Usage

```bash
doccov check [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

### Display

| Option | Default | Description |
|--------|---------|-------------|
| `--info` | `false` | Show brief summary instead of full report |
| `-o, --output <file>` | - | Output file path |
| `--format <format>` | `text` | Output format: `text`, `json`, `markdown`, `html`, `github` |
| `--limit <n>` | `20` | Max exports to show in report tables |

### Coverage Threshold

| Option | Default | Description |
|--------|---------|-------------|
| `--min-coverage <n>` | - | Minimum coverage percentage - exit 1 if not met |

### Validation

| Option | Default | Description |
|--------|---------|-------------|
| `--examples <mode>` | `types` | Example validation: `presence`, `types`, `run` |
| `--ignore-lint` | `false` | Skip lint checks |
| `--ignore-typecheck` | `false` | Skip example type checking |
| `--ignore-drift` | `false` | Skip drift detection |

### Auto-Fix

| Option | Default | Description |
|--------|---------|-------------|
| `--fix` | `false` | Auto-fix drift issues |
| `--dry-run` | `false` | Preview fixes without writing (requires `--fix`) |

### Filtering

| Option | Default | Description |
|--------|---------|-------------|
| `--include <patterns>` | - | Include exports matching pattern (comma-separated) |
| `--exclude <patterns>` | - | Exclude exports matching pattern (comma-separated) |

### Target

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --package <name>` | - | Target package in monorepo |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Quick Info

```bash
doccov check --info
```

Output:
```
Coverage: 85% (17/20 documented)
Drift: 2 issues
Lint: 1 warning
```

### Full Report

```bash
doccov check
```

Displays detailed coverage breakdown with missing signals and issues.

### CI with Threshold

```bash
doccov check --min-coverage 80
```

Exits with code 1 if coverage falls below 80%.

### Strict Mode

Require examples on all exports:

```bash
doccov check --examples presence
```

### Execute Examples

Run `@example` blocks and fail on runtime errors:

```bash
doccov check --examples run
```

Requires Node.js 22+ (uses `--experimental-strip-types`).

### Ignore Specific Checks

```bash
# Skip drift detection
doccov check --ignore-drift

# Skip lint checks
doccov check --ignore-lint

# Skip example type-checking
doccov check --ignore-typecheck
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

### Monorepo

Check specific package:

```bash
doccov check --package @myorg/core
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

## Output

### Info Mode (`--info`)

```
Coverage: 85% (17/20 documented)
Drift: 2 issues
Lint: 1 warning
```

### Full Report

```
DocCov Analysis Report
======================

Coverage: 85% (17/20 documented)

Missing Documentation:
  - createUser: missing examples
  - updateUser: missing params, examples

Drift Issues:
  - deleteUser: param-mismatch: @param userId not in signature

Lint Warnings:
  - fetchData: description should not start with "This function"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - no threshold set, or coverage met |
| 1 | Fail - coverage below `--min-coverage` threshold |

**Note:** Without `--min-coverage`, the command always exits 0 (information only). Use `--min-coverage` to enforce thresholds in CI.

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
    "docs:strict": "doccov check --min-coverage 90 --examples presence"
  }
}
```

## Drift Detection

Drift types detected:

| Type | Description |
|------|-------------|
| `param-mismatch` | `@param` doesn't match signature |
| `param-type-mismatch` | `@param {Type}` differs from actual |
| `return-type-mismatch` | `@returns {Type}` differs from actual |
| `optionality-mismatch` | `[param]` vs required param |
| `example-drift` | Example references missing export |
| `example-runtime-error` | Example throws (with `--examples run`) |
| `example-assertion-failed` | `// => value` assertion doesn't match output |
| `broken-link` | `{@link X}` target not found |

See [Drift Types](../../spec/drift-types.md) for full list.

## Auto-Fixable Drift Types

The `--fix` flag can automatically fix:

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

## See Also

- [spec](./spec.md) - Generate pure structural spec
- [Drift Types](../../spec/drift-types.md) - All drift detectors
