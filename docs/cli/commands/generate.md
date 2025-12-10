# doccov generate

Generate a pure OpenPkg structural specification from TypeScript source.

> **Note:** This command outputs pure structural JSON only. For coverage reports, use [`doccov check --format`](./check.md).

## Usage

```bash
doccov generate [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-o, --output <file>` | `openpkg.json` | Output file path |
| `--include <ids>` | - | Filter exports by identifier (comma-separated) |
| `--exclude <ids>` | - | Exclude exports by identifier (comma-separated) |
| `--show-diagnostics` | `false` | Print TypeScript diagnostics |
| `--skip-resolve` | `false` | Skip external type resolution from node_modules |
| `-p, --package <name>` | - | Target package name (for monorepos) |
| `--cwd <dir>` | `.` | Working directory |

## Examples

### Basic Generation

```bash
doccov generate
```

Auto-detects entry point, outputs `openpkg.json`.

### Custom Output

```bash
doccov generate -o api-spec.json
```

### Specific Entry

```bash
doccov generate src/lib/index.ts -o lib-spec.json
```

### Filter Exports

```bash
# Only include specific exports
doccov generate --include "createUser,updateUser,deleteUser"

# Exclude internal helpers
doccov generate --exclude "_internal*,debug*"
```

### Monorepo Package

```bash
doccov generate --package @myorg/utils -o utils-spec.json
```

### Skip External Types

Faster generation, but loses external type info:

```bash
doccov generate --skip-resolve
```

### Debug TypeScript Issues

```bash
doccov generate --show-diagnostics
```

## Output Format

The generated `openpkg.json` is a **pure structural format** (no coverage data):

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.3.0/openpkg.schema.json",
  "openpkg": "0.3.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "createUser",
      "name": "createUser",
      "kind": "function",
      "description": "Creates a new user",
      "signatures": [...]
    }
  ],
  "types": [...]
}
```

## Coverage Reports

For coverage reports with scores, missing signals, and drift issues, use the `check` command:

```bash
# Markdown report
doccov check --format markdown -o COVERAGE.md

# HTML report
doccov check --format html -o coverage.html

# JSON report with coverage data
doccov check --format json -o coverage.json
```

See [`doccov check`](./check.md) for details.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | TypeScript or generation error |

## See Also

- [check](./check.md) - Coverage validation and reports
- [diff](./diff.md) - Compare two specs
- [Configuration](../configuration.md) - Persistent settings

