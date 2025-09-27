# OpenPkg CLI

[![npm version](https://img.shields.io/npm/v/openpkg-cli.svg)](https://www.npmjs.com/package/openpkg-cli)

Command-line interface for generating OpenPkg specifications from TypeScript packages.

## Installation

```bash
# Using npm
npm install -g openpkg-cli

# Using bun  
bun install -g openpkg-cli

# Using yarn
yarn global add openpkg-cli

# Using pnpm
pnpm add -g openpkg-cli
```

## Commands

### `generate` - Generate OpenPkg Specification

Generate an OpenPkg specification from local TypeScript files. When node_modules is present, OpenPkg will automatically resolve and include external type definitions.

```bash
# Basic usage (auto-detects entry point)
openpkg generate

# Specify entry file
openpkg generate src/index.ts

# Custom output file
openpkg generate -o api-spec.json

# Target specific package in monorepo
openpkg generate --package @myorg/package-name

# Only keep selected exports
openpkg generate src/index.ts --include=createUser,deleteUser

# Auto-confirm all prompts
openpkg generate -y
```

#### Options

- `[entry]` - Entry file to analyze (optional, auto-detected from package.json)
- `-o, --output <file>` - Output file path (default: `openpkg.json`)
- `-p, --package <name>` - Target package in monorepo
- `--cwd <dir>` - Working directory (default: current directory)
- `--no-external-types` - Skip external type resolution from node_modules
- `--include <ids>` - Comma-separated (or repeated) export identifiers to keep
- `--exclude <ids>` - Comma-separated (or repeated) export identifiers to drop
- `-y, --yes` - Skip all prompts and use defaults

#### Monorepo Support

OpenPkg automatically detects monorepo structures:

```bash
# In monorepo root
openpkg generate --package @myorg/utils

# Auto-detects workspace package locations
# Works with npm, yarn, pnpm, and bun workspaces
```

### `analyze` - Analyze a local file

Inspect a TypeScript entry point, print a summary, and optionally persist the spec.

```bash
openpkg analyze src/index.ts --show=summary
openpkg analyze src/index.ts --show=spec,summary --output openpkg.json
openpkg analyze src/index.ts --include=createUser --exclude=internalHelper
```

#### Options

- `--show=<items>` – Comma-separated list of values to display (`summary`, `spec`). Default: `summary`.
- `-o, --output <file>` – Save the generated spec to a file.
- `--cwd <dir>` – Working directory used to resolve the entry path (defaults to current directory).
- `--include <ids>` – Filter exports by identifier before printing or saving.
- `--exclude <ids>` – Remove export identifiers from the generated spec.

### Configuration File

Create an `openpkg.config.ts` (or `.js` / `.mjs`) file to persist defaults:

```ts
import { defineConfig } from 'openpkg-cli/config';

export default defineConfig({
  include: ['createUser', 'deleteUser'],
  exclude: ['internalHelper'],
});
```

Place the file in your project root (or any ancestor directory). CLI flags take precedence over configuration values.

## Examples

### Basic Package Analysis

```bash
cd my-typescript-package
openpkg generate

# Output: openpkg.json with all exports and types
```

### Monorepo Package

```bash
openpkg generate --package @myorg/utils
# Analyzes packages/utils specifically
```

## Output Format

The generated `openpkg.json` follows this structure:

```json
{
  "$schema": "https://raw.githubusercontent.com/ryanwaits/openpkg/main/schemas/v0.1.0/openpkg.schema.json",
  "openpkg": "0.1.0",
  "meta": {
    "name": "package-name",
    "version": "1.0.0",
    "description": "Package description",
    "ecosystem": "js/ts"
  },
  "exports": [
    {
      "id": "functionName",
      "name": "functionName",
      "kind": "function",
      "signatures": [...],
      "description": "JSDoc description",
      "source": {
        "file": "src/index.ts",
        "line": 10
      }
    }
  ],
  "types": [
    {
      "id": "TypeName",
      "name": "TypeName", 
      "kind": "interface",
      "schema": {...},
      "description": "Type description"
    }
  ]
}
```

## Schema Validation

OpenPkg specifications include a `$schema` property that:
- Enables IDE validation and auto-completion
- Documents the expected structure
- Ensures compatibility with spec version

The schema is versioned alongside the spec format (currently v0.1.0) and hosted at:
```
https://raw.githubusercontent.com/ryanwaits/openpkg/main/schemas/v0.1.0/openpkg.schema.json
```

## Tips & Best Practices

1. **Source Files**: OpenPkg works best with TypeScript source files (`.ts`), not declaration files (`.d.ts`)

2. **Build Status**: If you see build warnings, consider building your package first for most accurate results

3. **Entry Points**: OpenPkg auto-detects entry points from `package.json` (`exports`, `main`, `module` fields)

4. **JSDoc Comments**: Add JSDoc comments to your exports for richer documentation in the spec

5. **Filter Gradually**: Start with broad includes, then refine with excludes to keep dependency chains intact

## Troubleshooting

### "Package not found in monorepo"
- Ensure the package name matches exactly what's in `package.json`
- Check that you're in the monorepo root directory

### "No exports found"
- Verify the entry point is correct
- Ensure your code uses `export` statements
- Check that TypeScript can compile your code

### "Network error occurred"
- Ensure you are connected to the internet and GitHub is reachable
- Re-run with `--show=debug` to view detailed fetch/log output
- GitHub rate limiting may apply for extremely frequent requests

## Development

To work on the CLI locally:

```bash
git clone https://github.com/ryanwaits/openpkg.git
cd openpkg/packages/cli
bun install
bun link

# Test your changes
openpkg generate --help
```

## License

MIT
