# DocCov

[![npm version](https://img.shields.io/npm/v/@doccov%2Fcli.svg)](https://www.npmjs.com/package/@doccov/cli)
[![npm version](https://img.shields.io/npm/v/@doccov%2Fsdk.svg)](https://www.npmjs.com/package/@doccov/sdk)
[![npm version](https://img.shields.io/npm/v/@openpkg-ts%2Fspec.svg)](https://www.npmjs.com/package/@openpkg-ts/spec)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**DocCov** is documentation coverage and drift detection for TypeScript. Think Codecov, but for your docs.

It turns TypeScript source code into a machine-readable JSON specification (OpenPkg format) and analyzes documentation completeness, detecting when TSDoc comments drift out of sync with your code.

## Features

- **Coverage Scoring**: Calculate documentation coverage % per export and package-wide
- **Drift Detection**: Detect when `@param`, `@returns`, `@deprecated`, and other tags drift from actual signatures
- **Fuzzy Rename Suggestions**: Get helpful "Did you mean?" hints when param names change
- **Rich CLI Reporting**: Pretty-printed errors with colors and actionable suggestions
- **CI Integration**: Fail builds when coverage drops below threshold

## Packages

- `@openpkg-ts/spec`: Canonical JSON Schema, TypeScript types, validation, normalization, diff helpers
- `@doccov/sdk`: Programmatic API for analyzing TypeScript projects and producing specs
- `@doccov/cli`: CLI for generating `openpkg.json` and checking documentation health

## Install

```bash
# CLI (global)
npm install -g @doccov/cli

# SDK (app local)
npm install @doccov/sdk

# Spec helpers (optional utility usage)
npm install @openpkg-ts/spec
```

## Quick Start

### Check Documentation Coverage

```bash
# Check coverage with 80% minimum threshold
doccov check --min-coverage 80

# Require @example blocks on all exports
doccov check --require-examples
```

### Generate OpenPkg Specification

```bash
doccov generate --output openpkg.json
```

### Programmatic Usage

```ts
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Coverage: ${spec.docs?.coverageScore}%`);
console.log(`${spec.exports.length} exports analyzed`);

// Check for drift
for (const exp of spec.exports) {
  if (exp.docs?.drift?.length) {
    console.log(`${exp.name}: ${exp.docs.drift.length} drift issues`);
  }
}
```

### Validate Specs

```ts
import { normalize, validateSpec } from '@openpkg-ts/spec';

const normalized = normalize(spec);
const result = validateSpec(normalized);
if (!result.ok) {
  throw new Error(result.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('\n'));
}
```

## Drift Detection

DocCov detects when your TSDoc comments don't match your code:

| Drift Type | Description |
|:-----------|:------------|
| **Parameter Mismatch** | `@param foo` but `foo` doesn't exist in signature |
| **Param Type Drift** | `@param {string} id` but actual type is `number` |
| **Return Type Drift** | `@returns {User}` but actual return is `Promise<User>` |
| **Optionality Drift** | `[param]` in JSDoc but param is required |
| **Deprecated Drift** | `@deprecated` tag without corresponding code deprecation |
| **Visibility Drift** | `@internal` tag on a public export |
| **Generic Constraint Drift** | `@template T` constraint doesn't match `T extends ...` |

## Documentation

- [CLI guide](./packages/cli/README.md)
- [SDK reference](./packages/sdk/README.md)
- [Spec utilities](./packages/spec/README.md)
- [Usage examples](./USAGE.md)

## License

MIT License — see [LICENSE](./LICENSE).
