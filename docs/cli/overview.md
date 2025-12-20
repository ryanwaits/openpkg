# CLI Overview

The `@doccov/cli` package provides the `doccov` command-line interface.

## Installation

```bash
npm install -g @doccov/cli
```

## Commands

| Command | Description |
|---------|-------------|
| [check](./commands/check.md) | Check coverage, detect drift, generate reports |
| [spec](./commands/spec.md) | Generate pure OpenPkg structural spec |
| [diff](./commands/diff.md) | Compare two specs |
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
doccov spec src/lib/index.ts
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
| 1 | Failure (coverage below threshold with `--min-coverage`) |

## Examples

```bash
# Quick coverage info
doccov check --info

# Check with threshold enforcement
doccov check --min-coverage 80

# Auto-fix documentation drift
doccov check --fix --dry-run

# Generate spec
doccov spec -o openpkg.json

# Compare specs
doccov diff old.json new.json

# Generate markdown report
doccov check --format markdown -o COVERAGE.md

# Scan GitHub repo
doccov scan https://github.com/tanstack/query
```

## Configuration

Create a config file for persistent settings:

```bash
doccov init --format yaml  # Creates doccov.yml
doccov init                # Creates doccov.config.mjs
```

See [Configuration](./configuration.md) for options.

## See Also

- [Installation](../getting-started/installation.md)
- [Quick Start](../getting-started/quick-start.md)
- [Configuration](./configuration.md)
