# Example Runner

Execute `@example` code blocks to detect runtime errors.

## Import

```typescript
import {
  runExample,
  runExamples,
  runExamplesWithPackage,
  detectExampleRuntimeErrors
} from '@doccov/sdk';
```

## Functions

### runExample()

Run a single example.

```typescript
const result = await runExample(
  code: string,
  options?: RunExampleOptions
): Promise<ExampleRunResult>;
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `string` | TypeScript/JavaScript code |
| `options` | `RunExampleOptions` | Execution options |

#### Options

```typescript
interface RunExampleOptions {
  timeout?: number;  // Max execution time in ms (default: 5000)
  cwd?: string;      // Working directory
}
```

#### Returns

```typescript
interface ExampleRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}
```

### runExamples()

Run multiple examples.

```typescript
const results = await runExamples(
  examples: string[],
  options?: RunExampleOptions
): Promise<Map<string, ExampleRunResult>>;
```

Returns a `Map` where keys are the example code strings.

### runExamplesWithPackage()

Run multiple examples with a local package pre-installed. This is what the CLI uses internally for `--run-examples`.

```typescript
const result = await runExamplesWithPackage(
  examples: string[],
  options: RunExamplesWithPackageOptions
): Promise<RunExamplesWithPackageResult>;
```

#### Options

```typescript
interface RunExamplesWithPackageOptions extends RunExampleOptions {
  packagePath: string;           // Path to local package to install
  packageManager?: 'npm' | 'pnpm' | 'bun';  // Auto-detected if omitted
  installTimeout?: number;       // Install timeout in ms (default: 60000)
}
```

#### Returns

```typescript
interface RunExamplesWithPackageResult {
  results: Map<number, ExampleRunResult>;  // Results by example index
  installSuccess: boolean;                  // Whether install succeeded
  installError?: string;                    // Error message if install failed
  totalDuration: number;                    // Total time including install
}
```

#### How It Works

1. Creates temp directory with `{"type":"module"}` package.json
2. Detects package manager from lockfiles (bun.lockb → bun, pnpm-lock.yaml → pnpm, else npm)
3. Runs `<pm> install <packagePath>` once
4. Runs all examples from temp directory (reuses node_modules)
5. Cleans up temp directory

### detectExampleRuntimeErrors()

Check example results for drift issues.

```typescript
const drifts = detectExampleRuntimeErrors(
  entry: SpecExport,
  results: Map<string, ExampleRunResult>
): SpecDocDrift[];
```

Returns array of `example-runtime-error` drift objects.

## Examples

### Run Single Example

```typescript
import { runExample } from '@doccov/sdk';

const code = `
const x = 1 + 1;
console.log(x);
`;

const result = await runExample(code, { timeout: 3000 });

if (result.success) {
  console.log('Output:', result.stdout);
} else {
  console.log('Error:', result.stderr);
}
```

### Run All Examples from Export

```typescript
import { runExamples } from '@doccov/sdk';

const examples = exportEntry.examples ?? [];
const results = await runExamples(examples, { timeout: 5000 });

for (const [code, result] of results) {
  console.log(`Example: ${code.slice(0, 50)}...`);
  console.log(`  Success: ${result.success}`);
  console.log(`  Duration: ${result.duration}ms`);
}
```

### Detect Runtime Errors

```typescript
import { DocCov, runExamples, detectExampleRuntimeErrors } from '@doccov/sdk';

const doccov = new DocCov();
const { spec } = await doccov.analyzeFileWithDiagnostics('src/index.ts');

for (const entry of spec.exports) {
  if (!entry.examples?.length) continue;
  
  const results = await runExamples(entry.examples, { timeout: 5000 });
  const drifts = detectExampleRuntimeErrors(entry, results);
  
  if (drifts.length > 0) {
    console.log(`${entry.name} has ${drifts.length} failing example(s)`);
    for (const drift of drifts) {
      console.log(`  ${drift.issue}`);
    }
  }
}
```

### Run Examples with Package Import

Use `runExamplesWithPackage()` when examples need to import from the package:

```typescript
import { runExamplesWithPackage, detectExampleRuntimeErrors } from '@doccov/sdk';

const examples = [
  `import { add } from 'my-package';
   console.log(add(1, 2));`
];

const result = await runExamplesWithPackage(examples, {
  packagePath: './path/to/my-package',
  timeout: 5000,
  installTimeout: 60000,
});

if (result.installSuccess) {
  console.log(`Ran ${result.results.size} examples`);
  for (const [i, r] of result.results) {
    console.log(`Example ${i}: ${r.success ? 'PASS' : 'FAIL'}`);
  }
} else {
  console.log('Install failed:', result.installError);
}
```

### Handle Markdown Code Blocks

Examples often include markdown fences:

```typescript
const code = `
\`\`\`typescript
const x = 1;
console.log(x);
\`\`\`
`;

// runExample automatically strips markdown fences
const result = await runExample(code);
```

## Execution Environment

### Requirements

- Node.js 22+ (for `--experimental-strip-types`)
- Examples run in isolated child process

### What Works

```typescript
// Console output
console.log('hello');

// Basic computation
const result = 1 + 1;

// Imports (if installed)
import { z } from 'zod';
```

### Current Limitations

- No DOM (`document`, `window`)
- No network access
- No file system access
- TypeScript parameter properties not supported (use explicit property declarations)

## Integration with CLI

The `--run-examples` flag uses `runExamplesWithPackage()` internally:

```bash
doccov check --run-examples
```

This automatically:
1. Detects your package manager from lockfiles
2. Installs your package in a temp directory
3. Runs all `@example` blocks
4. Reports failures as `example-runtime-error` drift

## Drift Output

When an example fails, it produces an `example-runtime-error` drift:

```json
{
  "type": "example-runtime-error",
  "target": "example-0",
  "issue": "@example failed: ReferenceError: foo is not defined",
  "suggestion": "Fix the example code or ensure dependencies are available"
}
```

## Local Testing

```bash
# Test example runner
bun test packages/sdk/test/example-runner.test.ts

# Run example manually
bun run -e "
  import { runExample } from './packages/sdk/src';
  const r = await runExample('console.log(1 + 1)');
  console.log(r);
"
```

## See Also

- [check --run-examples](../cli/commands/check.md) - CLI integration
- [Examples Run API](../api/endpoints/examples-run.md) - API endpoint
- [Drift Types](../spec/drift-types.md) - `example-runtime-error`

