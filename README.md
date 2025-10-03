# OpenPkg

> **Alpha Notice:** OpenPkg is in early alpha. APIs may change without notice; avoid production deployments until a stabilizing release is announced.

[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fcli.svg)](https://www.npmjs.com/package/@openpkg-ts/cli)
[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fsdk.svg)](https://www.npmjs.com/package/@openpkg-ts/sdk)
[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fspec.svg)](https://www.npmjs.com/package/@openpkg-ts/spec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenPkg turns TypeScript source code into a machine-readable JSON specification that mirrors the ergonomics of OpenAPI. Use it to power docs, SDKs, diff tooling, or any workflow that needs structured insight into package exports.

## Packages
- `@openpkg-ts/spec`: canonical JSON Schema, TypeScript types, validation, normalization, diff helpers.
- `@openpkg-ts/sdk`: programmatic API for analyzing TypeScript projects and producing specs.
- `@openpkg-ts/cli`: one-command generator for authoring `openpkg.json` files from the terminal.

## Install
```bash
# CLI (global)
npm install -g @openpkg-ts/cli

# SDK (app local)
npm install @openpkg-ts/sdk

# Spec helpers (optional utility usage)
npm install @openpkg-ts/spec
```

## Quick Examples
```bash
openpkg generate --output openpkg.json
```
```ts
import { OpenPkg } from '@openpkg-ts/sdk';

const openpkg = new OpenPkg();
const { spec } = await openpkg.analyzeFileWithDiagnostics('src/index.ts');
console.log(`${spec.exports.length} exports`, spec.meta.name);
```
```ts
import { normalize, validateSpec } from '@openpkg-ts/spec';

const normalized = normalize(spec);
const result = validateSpec(normalized);
if (!result.ok) {
  throw new Error(result.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('
'));
}
```
## Documentation
- [CLI guide](./packages/cli/README.md)
- [SDK reference](./packages/sdk/README.md)
- [Spec utilities](./packages/spec/README.md)
- [Examples](./examples/README.md)

## License

MIT © Ryan Waits
