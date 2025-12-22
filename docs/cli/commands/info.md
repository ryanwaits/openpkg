# doccov info

Quick coverage summary without detailed reports.

## Usage

```bash
doccov info [entry] [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Working directory |
| `--package <name>` | Target monorepo package |
| `--skip-resolve` | Skip external type resolution |

## Examples

```bash
doccov info
```

## Output

```
@myorg/core@1.0.0
  Exports:    42
  Coverage:   85%
  Drift:      3%
```

## Use Case

Fast check without:
- Threshold validation
- Report generation
- Example validation
- Filtering
- Caching overhead

Ideal for quick local checks during development.
