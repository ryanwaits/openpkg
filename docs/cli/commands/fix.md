# doccov fix

Automatically fix documentation drift by updating JSDoc comments to match your TypeScript signatures.

## Usage

```bash
doccov fix [entry] [options]
```

## Description

The `fix` command analyzes your codebase for documentation drift and automatically applies fixes to bring your JSDoc comments back in sync with your code. It can fix parameter mismatches, type discrepancies, optionality issues, and more.

## Options

| Option | Description |
|--------|-------------|
| `--cwd <dir>` | Working directory (default: current directory) |
| `--package <name>` | Target package name (for monorepos) |
| `--dry-run` | Preview changes without writing to files |
| `--only <types>` | Only fix specific drift types (comma-separated) |
| `--skip-resolve` | Skip external type resolution from node_modules |

## Supported Fix Types

The fix command can automatically correct the following drift types:

| Drift Type | Fix Applied |
|------------|-------------|
| `param-mismatch` | Remove stale `@param` tags, rename parameters |
| `param-type-mismatch` | Update `@param {type}` to match signature |
| `optionality-mismatch` | Add/remove `[param]` brackets for optional params |
| `return-type-mismatch` | Update `@returns {type}` to match signature |
| `generic-constraint-mismatch` | Update `@template T extends X` constraints |
| `example-assertion-failed` | Update `// => value` assertions to match output |
| `deprecated-mismatch` | Add/remove `@deprecated` tag |
| `async-mismatch` | Add/remove `@async` tag |
| `property-type-drift` | Update `@type {type}` for properties |

## Examples

### Preview Changes (Dry Run)

```bash
doccov fix --dry-run
```

Output:
```
Auto-detected entry point: src/index.ts
Analyzing documentation...
Analysis complete

Found 5 fixable issue(s)

Dry run - changes that would be made:

  src/index.ts:
    add [lines 1-6]
      + Remove stale @param b
      + Update @returns type to {number}
    multiply [lines 11-15]
      + Mark @param y as required
      + Update @param x type to {number}

Run without --dry-run to apply these changes.
```

### Apply All Fixes

```bash
doccov fix
```

Output:
```
Auto-detected entry point: src/index.ts
Analyzing documentation...
Analysis complete

Found 5 fixable issue(s)

Applying fixes...
Applied 3 fix(es) to 1 file(s)

  ✓ src/index.ts: 3 fix(es)
```

### Fix Specific Drift Types Only

```bash
# Only fix parameter-related issues
doccov fix --only param-mismatch,param-type-mismatch

# Only fix return type issues
doccov fix --only return-type-mismatch
```

### Fix a Specific Package in a Monorepo

```bash
doccov fix --package @myorg/core
```

### Fix with Custom Entry Point

```bash
doccov fix src/lib/index.ts
```

## How It Works

1. **Analysis**: Scans your TypeScript files and detects documentation drift
2. **Fix Generation**: For each drift issue, generates the minimal JSDoc patch needed
3. **Merge**: Merges fixes with existing JSDoc, preserving descriptions and other content
4. **Write**: Applies changes back to source files (unless `--dry-run`)

### Preservation Rules

The fix command preserves existing documentation:
- Descriptions are kept unless explicitly being fixed
- Unrelated tags (`@example`, `@see`, `@since`, etc.) are preserved
- Formatting and indentation match the existing style

## Non-Fixable Drift

Some drift types require human judgment and cannot be auto-fixed:

| Drift Type | Why Not Auto-Fixable |
|------------|---------------------|
| `example-drift` | Requires understanding example intent |
| `example-syntax-error` | Needs code correction, not just doc update |
| `example-runtime-error` | Requires fixing the example code |
| `broken-link` | Cannot determine correct link target |
| `visibility-mismatch` | Style/API design decision |

For these, use `doccov check` to identify issues and fix manually.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All fixes applied successfully (or no fixes needed) |
| 1 | Error occurred during analysis or fix application |

## Related Commands

- [`doccov check`](./check.md) - Detect drift without fixing
- [`doccov generate`](./generate.md) - Generate specification file
- [`doccov report`](./report.md) - Generate coverage reports
