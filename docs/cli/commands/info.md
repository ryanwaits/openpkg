# doccov info

Show a brief documentation coverage summary.

## Usage

```bash
doccov info [entry] [options]
```

## Arguments

| Argument | Description |
|----------|-------------|
| `entry` | Entry file or directory (auto-detected if omitted) |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--cwd <dir>` | `.` | Working directory |
| `-p, --package <name>` | - | Target package name (for monorepos) |
| `--skip-resolve` | `false` | Skip external type resolution from node_modules |

## Output

Displays a concise summary:

```
my-package@1.0.0

  Exports:    42
  Coverage:   85%
  Drift:      5%
```

## Examples

### Quick Check

```bash
doccov info
```

### Specific Package in Monorepo

```bash
doccov info --package @myorg/core
```

### Custom Entry Point

```bash
doccov info src/lib/index.ts
```

## Use Cases

- Quick health check of documentation status
- Pre-commit verification
- Dashboard/status displays
- Scripting and automation

## Comparison with `check`

| Feature | `info` | `check` |
|---------|--------|---------|
| Coverage score | Yes | Yes |
| Drift score | Yes | Yes |
| Detailed reports | No | Yes |
| Threshold enforcement | No | Yes |
| Auto-fix | No | Yes |
| Multiple formats | No | Yes |

Use `info` for quick status checks. Use `check` for CI enforcement and detailed reports.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Analysis error |

## See Also

- [check](./check.md) - Full validation with thresholds and reports
- [spec](./spec.md) - Generate OpenPkg specification
