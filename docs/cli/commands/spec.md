# doccov spec

Generate OpenPkg specification from TypeScript source.

> **Note:** For standalone extraction without DocCov, use [`tspec`](../tspec.md).

## Usage

```bash
doccov spec [entry] [options]
```

## Options

| Flag | Description |
|------|-------------|
| `--cwd <dir>` | Working directory |
| `-p, --package <name>` | Target monorepo package |
| `-o, --output <file>` | Output path (default: `openpkg.json`) |
| `-f, --format <fmt>` | `json` (default) or `api-surface` |
| `--include <patterns>` | Include exports (comma-separated) |
| `--exclude <patterns>` | Exclude exports (comma-separated) |
| `--visibility <tags>` | Filter by release tags |
| `--skip-resolve` | Skip external type resolution |
| `--max-type-depth <n>` | Type depth limit (default: 20) |
| `--no-cache` | Bypass cache |
| `--show-diagnostics` | Show TypeScript diagnostics |
| `--verbose` | Show generation metadata |

## Examples

### Generate spec

```bash
doccov spec
# Creates openpkg.json
```

### Custom entry point

```bash
doccov spec src/index.ts -o api-spec.json
```

### Filter exports

```bash
doccov spec --include "use*,My*" --exclude "*Internal"
```

### Public API only

```bash
doccov spec --visibility public
```

### Show metadata

```bash
doccov spec --verbose
```

## Output

### json (default)

OpenPkg spec with:

```json
{
  "$schema": "https://openpkg.dev/schemas/v0.4.0/openpkg.schema.json",
  "openpkg": "0.4.0",
  "meta": {
    "name": "@myorg/core",
    "version": "1.0.0"
  },
  "exports": [...],
  "types": [...],
  "generation": {
    "generator": "@doccov/cli@0.21.0",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

### api-surface

Human-readable API documentation text format.

## Entry Point Detection

Resolution order:
1. CLI argument
2. `package.json` → `types` / `typings`
3. `package.json` → `exports`
4. `package.json` → `main` / `module`
5. Fallback: `src/index.ts`, `index.ts`

## Generation Metadata

The `generation` field captures:

- Timestamp
- Generator name/version
- Entry point source (how detected)
- Declaration-only flag (.d.ts)
- External types resolution status
- Package manager detected
- Monorepo status
