# doccov check

Check documentation coverage, detect drift, validate examples, and generate coverage reports.

## Usage

```bash
doccov check [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

### Output

| Option | Default | Description |
|--------|---------|-------------|
| `--format <format>` | `text` | Output format: `text`, `json`, `markdown`, `html`, `github` |
| `-o, --output <file>` | - | Custom output path (overrides default .doccov/ path) |
| `--stdout` | `false` | Output to stdout instead of writing to .doccov/ |
| `--limit <n>` | `20` | Max exports to show in report tables |
| `--update-snapshot` | `false` | Force regenerate .doccov/report.json |

### Thresholds

| Option | Default | Description |
|--------|---------|-------------|
| `--min-coverage <n>` | - | Minimum coverage percentage (0-100) - exit 1 if not met |
| `--max-drift <n>` | - | Maximum drift percentage allowed (0-100) - exit 1 if exceeded |

### Example Validation

| Option | Default | Description |
|--------|---------|-------------|
| `--examples [mode]` | - | Example validation: `presence`, `typecheck`, `run` (comma-separated). Bare flag runs all. |

### Auto-Fix

| Option | Default | Description |
|--------|---------|-------------|
| `--fix` | `false` | Auto-fix drift issues |
| `--write` | `false` | Alias for --fix |
| `--dry-run` | `false` | Preview fixes without writing (requires `--fix`) |

### Target

| Option | Default | Description |
|--------|---------|-------------|
| `-p, --package <name>` | - | Target package in monorepo |
| `--cwd <dir>` | `.` | Working directory |

### Analysis

| Option | Default | Description |
|--------|---------|-------------|
| `--skip-resolve` | `false` | Skip external type resolution from node_modules |
| `--max-type-depth <n>` | `20` | Maximum depth for type conversion |
| `--no-cache` | `false` | Bypass spec cache and force regeneration |

## Examples

### Quick Summary

For a brief summary, use the [`info`](./info.md) command:

```bash
doccov info
```

### Full Report

```bash
doccov check
```

Displays detailed coverage breakdown with issues.

### CI with Thresholds

```bash
# Enforce minimum coverage
doccov check --min-coverage 80

# Enforce both coverage and drift limits
doccov check --min-coverage 80 --max-drift 10
```

Exits with code 1 if thresholds are not met.

### Example Validation

```bash
# Check that examples exist
doccov check --examples presence

# Type-check examples
doccov check --examples typecheck

# Run examples and check for runtime errors
doccov check --examples run

# Run all validations
doccov check --examples

# Combine modes
doccov check --examples presence,typecheck
```

Running examples requires Node.js 22+ (uses `--experimental-strip-types`).

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
# JSON report
doccov check --format json -o coverage.json

# Markdown report
doccov check --format markdown -o COVERAGE.md

# HTML report
doccov check --format html -o coverage.html

# GitHub Actions summary format
doccov check --format github
```

### Output to Stdout

```bash
doccov check --format json --stdout
```

### Skip Caching

Force a fresh analysis:

```bash
doccov check --no-cache
```

## Output

### Text Format (default)

```
my-package@1.0.0

  Exports:    42
  Coverage:   85% (min 80%)
  Drift:      5% (max 10%)
  Examples:   validated
  Quality:    2 warnings

Check passed (coverage 85% >= 80%, drift 5% <= 10%)
```

### With Threshold Failures

```
my-package@1.0.0

  Exports:    42
  Coverage:   72% (min 80%)
  Drift:      15% (max 10%)

Use --format json or --format markdown for detailed reports
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass - no threshold set, or all thresholds met |
| 1 | Fail - coverage below `--min-coverage`, drift above `--max-drift`, quality errors, or example type errors |

**Note:** Without thresholds, the command always exits 0 (information only). Use `--min-coverage` and/or `--max-drift` to enforce thresholds in CI.

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check docs coverage
  run: npx doccov check --min-coverage 80 --max-drift 10
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
    "docs:strict": "doccov check --min-coverage 90 --max-drift 5 --examples typecheck"
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

- [info](./info.md) - Quick summary
- [spec](./spec.md) - Generate pure structural spec
- [Drift Types](../../spec/drift-types.md) - All drift detectors
- [Configuration](../configuration.md) - Config file options
