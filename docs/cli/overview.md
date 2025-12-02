# CLI Overview

The `@doccov/cli` package provides the `doccov` command-line interface.

## Installation

```bash
npm install -g @doccov/cli
```

## Commands

| Command | Description |
|---------|-------------|
| [generate](./commands/generate.md) | Generate OpenPkg spec from TypeScript |
| [check](./commands/check.md) | Validate coverage thresholds, auto-fix drift |
| [diff](./commands/diff.md) | Compare two specs |
| [report](./commands/report.md) | Generate coverage reports |
| [scan](./commands/scan.md) | Analyze remote GitHub repos |
| [init](./commands/init.md) | Create config file |

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--cwd <dir>` | Working directory (default: current) |
| `--package <name>` | Target package in monorepo |
| `--version` | Show version number |
| `--help` | Show help |

## Entry Point Detection

Most commands auto-detect the entry point:

1. `package.json` → `types` field
2. `package.json` → `main` field (if `.ts`)
3. `src/index.ts`
4. `index.ts`

Override with positional argument:

```bash
doccov generate src/lib/index.ts
```

## Monorepo Support

Target a specific package:

```bash
doccov check --package @myorg/utils
```

DocCov auto-detects monorepo structure from:
- `pnpm-workspace.yaml`
- `package.json` workspaces
- `lerna.json`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Failure (coverage below threshold, drift detected, etc.) |

## Examples

```bash
# Check with defaults (80% coverage)
doccov check

# Auto-fix documentation drift
doccov check --write --dry-run

# Generate spec
doccov generate -o openpkg.json

# Compare specs
doccov diff old.json new.json

# Generate markdown report
doccov report --output markdown

# Scan GitHub repo
doccov scan https://github.com/tanstack/query
```

## Configuration

Create `doccov.config.ts` for persistent settings:

```bash
doccov init
```

See [Configuration](./configuration.md) for options.

## See Also

- [Installation](../getting-started/installation.md)
- [Quick Start](../getting-started/quick-start.md)
- [Configuration](./configuration.md)

