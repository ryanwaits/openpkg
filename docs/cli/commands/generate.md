# doccov generate

Generate an OpenPkg specification file from TypeScript source.

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
| `--no-external-types` | `false` | Skip external type resolution from node_modules |
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
doccov generate --no-external-types
```

### Debug TypeScript Issues

```bash
doccov generate --show-diagnostics
```

## Output Format

The generated `openpkg.json` contains:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.2.0/openpkg.schema.json",
  "openpkg": "0.2.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0"
  },
  "exports": [
    {
      "id": "createUser",
      "name": "createUser",
      "kind": "function",
      "description": "Creates a new user",
      "signatures": [...],
      "docs": {
        "coverageScore": 100,
        "missing": [],
        "drift": []
      }
    }
  ],
  "types": [...],
  "docs": {
    "coverageScore": 85
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | TypeScript or generation error |

## Local Testing

```bash
# From repo root
bun run packages/cli/src/cli.ts generate tests/fixtures/simple-math.ts -o /tmp/spec.json

# View output
cat /tmp/spec.json | jq '.docs'
```

## See Also

- [check](./check.md) - Validate generated spec
- [report](./report.md) - Generate coverage report
- [Configuration](../configuration.md) - Persistent settings

