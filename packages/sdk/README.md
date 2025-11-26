# @doccov/sdk

Programmatic API for documentation coverage analysis.

## Install

```bash
npm install @doccov/sdk
```

## Usage

```typescript
import { DocCov } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Coverage: ${spec.docs?.coverageScore}%`);

// Check for drift
for (const exp of spec.exports) {
  if (exp.docs?.drift?.length) {
    console.log(`${exp.name}: ${exp.docs.drift.length} drift issues`);
  }
}
```

## Exports

- `DocCov` - Main analysis class
- `runExample` / `runExamples` - Execute @example blocks
- `detectExampleRuntimeErrors` - Check for runtime failures

## Documentation

- [SDK Overview](../../docs/sdk/overview.md)
- [DocCov Class](../../docs/sdk/doccov-class.md)
- [Example Runner](../../docs/sdk/example-runner.md)
- [Filtering](../../docs/sdk/filtering.md)

## License

MIT
