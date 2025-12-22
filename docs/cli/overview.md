# CLI Overview

`@doccov/cli` - Command-line tool for TypeScript documentation coverage analysis.

## Installation

```bash
npm install -g @doccov/cli
# or
npx @doccov/cli <command>
```

## Commands

| Command | Description |
|---------|-------------|
| [`check`](./commands/check.md) | Analyze coverage, validate thresholds, auto-fix drift |
| [`spec`](./commands/spec.md) | Generate OpenPkg specification JSON |
| [`diff`](./commands/diff.md) | Compare specs, detect breaking changes |
| [`info`](./commands/info.md) | Quick coverage summary |
| [`init`](./commands/init.md) | Create config file |
| [`trends`](./commands/trends.md) | Track coverage over time |

## Global Options

All commands support:

```
--cwd <dir>       Working directory (default: process.cwd())
--package <name>  Target package in monorepo
--no-cache        Bypass spec cache
```

## Exit Codes

- `0` - Success
- `1` - Threshold failure or error

## Config File

Commands read from `doccov.yml`, `doccov.config.js`, or `doccov.config.ts`. See [Configuration](./configuration.md).

## Output Formats

Most commands support multiple output formats via `--format`:

- `text` - Terminal output (default)
- `json` - Machine-readable JSON
- `markdown` - Markdown report
- `html` - Dark-themed HTML page
- `github` - GitHub Actions annotations

## Monorepo Support

Use `--package <name>` to target specific workspace package:

```bash
doccov check --package @myorg/core
```

Auto-detects: yarn workspaces, pnpm workspaces, lerna, turborepo.
