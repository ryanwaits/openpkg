# OpenPkg CLI

[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fcli.svg)](https://www.npmjs.com/package/@openpkg-ts/cli)

Command-line interface for producing OpenPkg specs from TypeScript projects.

## Installation

```bash
# npm
npm install -g @openpkg-ts/cli

# bun
bun add -g @openpkg-ts/cli

# yarn
yarn global add @openpkg-ts/cli

# pnpm
pnpm add -g @openpkg-ts/cli
```

## Quick Start

```bash
# Generate openpkg.json for the current package
openpkg generate

# Target a specific entry file
openpkg generate src/index.ts

# Scaffold an OpenPkg config
openpkg init
```

`openpkg generate` discovers the package manifest, figures out the correct entry point, resolves external .d.ts files when `node_modules` is present, and writes `openpkg.json` by default.

## Commands

### `openpkg init`

Create a starter `openpkg.config` file in the current project. The CLI picks an extension automatically:

- `openpkg.config.js` when the nearest `package.json` declares `{ "type": "module" }`
- `openpkg.config.mjs` otherwise (compatible with both ESM and CommonJS projects)

```bash
openpkg init --cwd . --format auto
```

Options:

- `--cwd <dir>` – Directory where the config should be created (defaults to current directory).
- `--format <auto|mjs|js|cjs>` – Override the generated file extension.

The command aborts when a config already exists anywhere up the directory tree.

### `openpkg generate [entry]`

Generate an OpenPkg spec from a file or package entry point.

```bash
openpkg generate src/index.ts --output lib/openpkg.json --include=createUser
```

Key behaviors:

- Auto-detects the entry point when `[entry]` is omitted (using `exports`, `main`, or TypeScript config fields).
- Honors `openpkg.config.*` defaults and then applies CLI flags on top.
- Emits diagnostics from the TypeScript compiler and from OpenPkg's filtering passes.
- Writes formatted JSON to `openpkg.json` (or the path supplied via `--output`).

#### Options

- `[entry]` – Entry file to analyze. Optional when the package exposes a single entry point.
- `-o, --output <file>` – Output path (default: `openpkg.json`).
- `-p, --package <name>` – Resolve and analyze a workspace package by name.
- `--cwd <dir>` – Base directory for resolution (default: current directory).
- `--no-external-types` – Skip pulling types from `node_modules`.
- `--include <ids>` – Keep only the listed export identifiers (comma-separated or repeatable).
- `--exclude <ids>` – Drop the listed export identifiers.
- `-y, --yes` – Assume "yes" for prompts.

## Configuration File

Create an `openpkg.config.ts`, `.js`, or `.mjs` file anywhere above your working directory to keep reusable defaults. Prefer `.mjs`/`.cjs` if you are running the CLI under Node.js without a TypeScript loader.

```ts
// openpkg.config.mjs
import { defineConfig } from '@openpkg-ts/cli/config';

export default defineConfig({
  include: ['createUser', 'deleteUser'],
  exclude: ['internalHelper'],
  resolveExternalTypes: true,
});
```

The CLI searches the current directory and its parents for the first config file and merges those settings with flags provided on the command line. `defineConfig` helps with type-safety but is optional—you can export a plain object as well.

### Supported Options

- `include: string[]` – Export identifiers to keep.
- `exclude: string[]` – Export identifiers to drop.
- `resolveExternalTypes?: boolean` – Override automatic detection of external type resolution.

CLI flags always win over config values. When both provide filters, the CLI prints a short summary of how the sets were combined.

## Filtering Tips

- `--include` narrows the spec to the identifiers you care about. Any referenced types that fall outside the allow-list are removed unless they are still referenced.
- `--exclude` is useful for dropping experimental or internal APIs while keeping everything else.
- Combine filters in configuration for defaults and override per run via CLI flags.

## Monorepo Support

Supply `--package <name>` from the workspace root to locate a child package automatically. The CLI understands npm, pnpm, yarn, and bun workspace layouts.

```bash
openpkg generate --package @myorg/transactions
```

## Output

After a successful run the CLI prints:

- The relative path to the written spec.
- Counts for exports and types earned after filtering.
- Any diagnostics collected during analysis.

The JSON schema for the output lives at `schemas/v0.1.0/openpkg.schema.json` in this repository.

## License

MIT
