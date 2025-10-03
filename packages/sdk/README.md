# OpenPkg SDK

[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fsdk.svg)](https://www.npmjs.com/package/@openpkg-ts/sdk)

TypeScript SDK for generating and post-processing OpenPkg specs directly from your tooling.

## Installation

```bash
# npm
npm install @openpkg-ts/sdk

# bun
bun add @openpkg-ts/sdk

# yarn
yarn add @openpkg-ts/sdk

# pnpm
pnpm add @openpkg-ts/sdk
```

## Quick Start

```ts
import { OpenPkg } from '@openpkg-ts/sdk';

const openpkg = new OpenPkg({
  resolveExternalTypes: true,
});

const spec = await openpkg.analyzeFile('./src/index.ts', {
  filters: {
    include: ['createUser', 'deleteUser'],
  },
});

console.log(`exports: ${spec.exports.length}`);
console.log(`types: ${spec.types?.length ?? 0}`);
```

`OpenPkg` automatically resolves local sources, merges in declaration files, and keeps type references intact. Use `filters.include` / `filters.exclude` to narrow the surface area that lands in the final spec.

## Filtering Exports

```ts
import { analyzeFile } from '@openpkg-ts/sdk';

const spec = await analyzeFile('./src/index.ts', {
  filters: {
    include: ['publicFunction'],
    exclude: ['internalHelper'],
  },
});
```

Filtering trims both the `exports` array and orphaned items under `types`. The SDK will surface informational diagnostics whenever an identifier cannot be located or when filtering drops transitive types you may still need.

## Diagnostics

Use the `analyzeFileWithDiagnostics` or `analyzeWithDiagnostics` helpers when you need visibility into parsing or filtering issues.

```ts
import { OpenPkg } from '@openpkg-ts/sdk';

const openpkg = new OpenPkg();
const { spec, diagnostics } = await openpkg.analyzeFileWithDiagnostics('./src/index.ts');

diagnostics.forEach((diagnostic) => {
  const location = diagnostic.location?.file
    ? `${diagnostic.location.file}:${diagnostic.location.line ?? '?'}:${diagnostic.location.column ?? '?'}`
    : '(unknown)';
  console.log(`[${diagnostic.severity}] ${location} ${diagnostic.message}`);
});
```

Diagnostics normalize TypeScript compiler messages into `error`, `warning`, and `info` severity levels so you can decide how to surface them in your own tools.

## Programmatic Workflows

### Analyze in-memory code

```ts
import { analyze } from '@openpkg-ts/sdk';

const spec = await analyze(
  `export const sum = (a: number, b: number) => a + b;`,
  { filters: { include: ['sum'] } },
);
```

### Batch project analysis

```ts
import { OpenPkg } from '@openpkg-ts/sdk';
import { glob } from 'glob';

const openpkg = new OpenPkg();
const files = await glob('packages/**/src/index.ts');
const specs = await Promise.all(files.map((file) => openpkg.analyzeFile(file)));
```

## API Surface

- `new OpenPkg(options?)`
  - `analyze(code, fileName?, options?)`
  - `analyzeFile(filePath, options?)`
  - `analyzeWithDiagnostics(code, fileName?, options?)`
  - `analyzeFileWithDiagnostics(filePath, options?)`
- `analyze(code, options?)` – convenience wrapper
- `analyzeFile(filePath, options?)` – convenience wrapper
- `extractPackageSpec(entry, packageDir, source, options)` – lower-level extractor
- Types: `OpenPkgSpec`, `FilterOptions`, `AnalyzeOptions`, `AnalysisResult`, `Diagnostic`

## Development

```bash
git clone https://github.com/ryanwaits/openpkg.git
cd openpkg
bun install
bun run build:sdk
bun test
```

## License

MIT
