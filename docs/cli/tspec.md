# tspec CLI

Standalone TypeScript extraction to OpenPkg format.

> **Package:** `@openpkg-ts/extract`

## Overview

`tspec` extracts TypeScript exports to the OpenPkg specification format. It's the standalone extraction tool that powers `doccov spec` under the hood.

Use `tspec` when you need:
- Pure TypeScript API extraction without coverage analysis
- Tool-agnostic `openpkg.json` for other consumers
- Minimal dependencies (no DocCov required)

## Installation

```bash
npm install -g @openpkg-ts/extract
# or
bunx @openpkg-ts/extract
```

## Usage

```bash
tspec [entry] [options]
```

## Options

| Flag | Description |
|------|-------------|
| `-o, --output <file>` | Output path (default: `openpkg.json`) |
| `--include <patterns>` | Include exports (comma-separated) |
| `--exclude <patterns>` | Exclude exports (comma-separated) |
| `--skip-resolve` | Skip external type resolution |
| `--max-depth <n>` | Type depth limit (default: 20) |

## Examples

### Basic extraction

```bash
tspec
# Creates openpkg.json from auto-detected entry

tspec src/index.ts -o api.json
# Explicit entry, custom output
```

### Filter exports

```bash
tspec --include "use*,create*" --exclude "*Internal"
```

## Output

Generates OpenPkg v0.4.0 spec:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json",
  "openpkg": "0.4.0",
  "meta": {
    "name": "my-package",
    "version": "1.0.0",
    "ecosystem": "js/ts"
  },
  "exports": [...],
  "types": [...],
  "generation": {
    "generator": "@openpkg-ts/extract@0.1.0",
    "timestamp": "2024-12-26T10:00:00Z"
  }
}
```

## tspec vs doccov spec

| Aspect | `tspec` | `doccov spec` |
|--------|---------|---------------|
| Package | `@openpkg-ts/extract` | `@doccov/cli` |
| Purpose | Pure extraction | DocCov workflow integration |
| Config | CLI flags only | Uses `doccov.yml` |
| Output | `openpkg.json` | `openpkg.json` |
| Dependencies | Minimal | Full DocCov stack |

Both produce identical OpenPkg output. Use `tspec` for standalone extraction, `doccov spec` when already using DocCov.
