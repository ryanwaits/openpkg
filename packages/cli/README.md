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

Generate an OpenPkg specification from local TypeScript files.

```bash
# Basic usage (auto-detects entry point)
openpkg generate

# Specify entry file
openpkg generate src/index.ts

# Custom output file
openpkg generate -o api-spec.json

# Target specific package in monorepo
openpkg generate --package @myorg/package-name

# Skip build warnings
openpkg generate --skip-build-check

# Auto-confirm all prompts
openpkg generate -y
```

#### Options

- `[entry]` - Entry file to analyze (optional, auto-detected from package.json)
- `-o, --output <file>` - Output file path (default: `openpkg.json`)
- `-p, --package <name>` - Target package in monorepo
- `--cwd <dir>` - Working directory (default: current directory)
- `--skip-build-check` - Skip TypeScript build status warnings
- `-y, --yes` - Skip all prompts and use defaults

#### Monorepo Support

OpenPkg automatically detects monorepo structures:

```bash
# In monorepo root
openpkg generate --package @myorg/utils

# Auto-detects workspace package locations
# Works with npm, yarn, pnpm, and bun workspaces
```

### `analyze` - Analyze from URL (Studio Feature)

Analyze TypeScript files directly from GitHub URLs using OpenPkg Studio.

```bash
# Basic analysis
openpkg analyze https://github.com/tanstack/query/blob/main/packages/query-core/src/query.ts

# Show import analysis
openpkg analyze <url> --show=imports

# Follow and analyze imports recursively
openpkg analyze <url> --follow=imports

# Limit import depth
openpkg analyze <url> --follow=imports --max-depth=3

# Multiple display options
openpkg analyze <url> --show=spec,imports,summary --follow=imports

# Debug mode
openpkg analyze <url> --show=debug
```

#### Options

- `--show=<items>` - What to display (comma-separated):
  - `spec` - Generate OpenPkg specification (default)
  - `imports` - Show detailed import analysis
  - `summary` - Show exports/types breakdown
  - `debug` - Display debug information

- `--follow=<items>` - What to follow (comma-separated):
  - `imports` - Recursively analyze relative imports

- `--max-depth <n>` - Maximum depth for import resolution (default: 5)
- `-o, --output <file>` - Save specification to file (default: `openpkg.json`)

#### Import Analysis Features

When using `--show=imports`, you'll see:
- Categorized imports (relative, package, absolute)
- Type-only imports marked
- Import counts and details
- Circular dependency detection

When using `--follow=imports`, the tool will:
- Recursively fetch and analyze imported files
- Build complete type definitions across files
- Show dependency graph statistics
- Handle circular dependencies gracefully

## Examples

### Basic Package Analysis

```bash
# Simple package
cd my-typescript-package
openpkg generate

# Output: openpkg.json with all exports and types
```

### Monorepo Package

```bash
# In monorepo root with packages:
# - packages/utils
# - packages/cli  
# - packages/sdk

openpkg generate --package @myorg/utils
# Analyzes packages/utils specifically
```

### GitHub URL Analysis

```bash
# Analyze a single file
openpkg analyze https://github.com/microsoft/typescript/blob/main/src/compiler/types.ts

# Analyze with imports
openpkg analyze https://github.com/remix-run/react-router/blob/main/packages/router/index.ts \
  --follow=imports \
  --show=spec,imports,summary

# Debug import resolution
openpkg analyze https://github.com/vercel/next.js/blob/canary/packages/next/server.ts \
  --follow=imports \
  --max-depth=2 \
  --show=debug
```

### Complex Import Scenarios

Check out the [examples directory](../../examples/README.md) for handling:
- Circular dependencies
- Barrel exports (re-exports)
- Deep import chains
- Mixed import styles
- Type-only imports

## Output Format

The generated `openpkg.json` follows this structure:

```json
{
  "openpkg": "1.0.0",
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

## Tips & Best Practices

1. **Source Files**: OpenPkg works best with TypeScript source files (`.ts`), not declaration files (`.d.ts`)

2. **Build Status**: If you see build warnings, consider building your package first for most accurate results

3. **Entry Points**: OpenPkg auto-detects entry points from `package.json` (`exports`, `main`, `module` fields)

4. **JSDoc Comments**: Add JSDoc comments to your exports for richer documentation in the spec

5. **Import Resolution**: Use `--follow=imports` for complete type analysis across multiple files

## Troubleshooting

### "Package not found in monorepo"
- Ensure the package name matches exactly what's in `package.json`
- Check that you're in the monorepo root directory

### "No exports found"
- Verify the entry point is correct
- Ensure your code uses `export` statements
- Check that TypeScript can compile your code

### "Studio connection failed"
- The `analyze` command requires OpenPkg Studio running locally
- Check that http://localhost:3000 is accessible
- Some features may require authentication

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