# @openpkg-ts/sdk

Programmatic API for extracting OpenPkg specs from TypeScript projects.

## Install
```bash
npm install @openpkg-ts/sdk
```

## Minimal Usage
```ts
import { OpenPkg } from '@openpkg-ts/sdk';

const openpkg = new OpenPkg();
const { spec, diagnostics } = await openpkg.analyzeFileWithDiagnostics('src/index.ts');

console.log(`${spec.exports.length} exports`);
console.log('diagnostics', diagnostics.length);
```

## Helper Functions
- `analyze(code)` – analyze an in-memory string
- `analyzeFile(path)` – analyze a single entry point
- `analyzeWithDiagnostics` / `analyzeFileWithDiagnostics` – include TypeScript diagnostics
- `extractPackageSpec` – lower-level hook used by the CLI

## Filters
```ts
const { spec } = await openpkg.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['publicApi'],
    exclude: ['internalHelper'],
  },
});
```

## See Also
- [Spec helpers](../spec/README.md)
- [CLI generator](../cli/README.md)
- [Examples](../../examples/README.md)

MIT License
