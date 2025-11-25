# @doccov/sdk

Programmatic API for documentation coverage analysis and drift detection in TypeScript.

## Install
```bash
npm install @doccov/sdk
```

## Minimal Usage
```ts
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const { spec, diagnostics } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Coverage: ${spec.docs?.coverageScore}%`);
console.log(`${spec.exports.length} exports analyzed`);
```

## Checking for Drift
```ts
for (const exp of spec.exports) {
  const drift = exp.docs?.drift ?? [];
  if (drift.length > 0) {
    console.log(`${exp.name}: ${drift.length} drift issues`);
    for (const d of drift) {
      console.log(`  - ${d.issue}`);
      if (d.suggestion) {
        console.log(`    Suggestion: ${d.suggestion}`);
      }
    }
  }
}
```

## Helper Functions
- `analyze(code)` – analyze an in-memory string
- `analyzeFile(path)` – analyze a single entry point
- `analyzeWithDiagnostics` / `analyzeFileWithDiagnostics` – include TypeScript diagnostics
- `extractPackageSpec` – lower-level hook used by the CLI

## Filters
```ts
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts', {
  filters: {
    include: ['publicApi'],
    exclude: ['internalHelper'],
  },
});
```

## Coverage Metadata
Each export includes documentation health info:
```ts
interface SpecDocsMetadata {
  coverageScore?: number;           // 0-100
  missing?: ('description' | 'params' | 'returns' | 'examples')[];
  drift?: SpecDocDrift[];           // List of drift issues
}
```

## See Also
- [Spec helpers](../spec/README.md)
- [CLI usage](../cli/README.md)
- [Fixtures](../../tests/fixtures/README.md)

MIT License
