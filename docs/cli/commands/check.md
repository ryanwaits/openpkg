# doccov check

Validate documentation coverage and detect drift.

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
| `--run-examples` | `false` | Execute `@example` blocks, fail on errors |
| `--ignore-drift` | `false` | Don't fail on documentation drift |
| `--no-external-types` | `false` | Skip external type resolution |
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
doccov check --run-examples
```

Requires Node.js 22+ (uses `--experimental-strip-types`).

**Package Pre-Install**: When `--run-examples` is used, the CLI automatically installs the local package in a temp directory before running examples. This means examples that import from your package work:

```typescript
/**
 * @example
 * import { add } from 'my-package';
 * console.log(add(1, 2)); // 3
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

The CLI auto-detects your package manager (bun/pnpm/npm) from lockfiles.

### Ignore Drift

Pass even with drift issues:

```bash
doccov check --ignore-drift
```

### Monorepo

Check specific package:

```bash
doccov check --package @myorg/core
```

### Combined

```bash
doccov check --min-coverage 95 --require-examples --run-examples
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
| `broken-link` | `{@link X}` target not found |

See [Drift Types](../../spec/drift-types.md) for full list.

## Local Testing

```bash
# Test passing fixture
bun run packages/cli/src/cli.ts check tests/fixtures/docs-coverage

# Test drift detection
bun run packages/cli/src/cli.ts check tests/fixtures/drift-param-mismatch
```

## See Also

- [generate](./generate.md) - Generate spec first
- [report](./report.md) - Detailed coverage report
- [Drift Types](../../spec/drift-types.md) - All drift detectors

