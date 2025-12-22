# Example Validation

Validate `@example` blocks in JSDoc comments.

## Validation Modes

| Mode | Description |
|------|-------------|
| `presence` | Check examples exist |
| `typecheck` | TypeScript compilation |
| `run` | Execute and check assertions |

## Usage

```typescript
import { validateExamples } from '@doccov/sdk';

const result = await validateExamples(spec, {
  validations: ['presence', 'typecheck', 'run'],
  packagePath: process.cwd(),
  packageName: '@myorg/core',
  timeout: 30000,
});
```

## Options

```typescript
interface ExampleValidationOptions {
  validations: ExampleValidation[];
  packagePath: string;
  packageName?: string;
  exportNames?: string[];     // Filter to specific exports
  timeout?: number;           // Runtime timeout (ms)
  installTimeout?: number;    // npm install timeout (ms)
  llmAssertionParser?: (example: string) => Promise<LLMAssertionResult | null>;
}

type ExampleValidation = 'presence' | 'typecheck' | 'run';
```

## Results

```typescript
interface ExampleValidationResult {
  validations: ExampleValidation[];
  presence?: PresenceResult;
  typecheck?: TypecheckValidationResult;
  run?: RunValidationResult;
}
```

### Presence Result

```typescript
interface PresenceResult {
  total: number;        // Total exports
  withExamples: number; // Exports with @example
  missing: string[];    // Export names without examples
}
```

### Typecheck Result

```typescript
interface TypecheckValidationResult {
  passed: number;
  failed: number;
  errors: TypecheckError[];
}

interface TypecheckError {
  exportName: string;
  exampleIndex: number;
  message: string;
  line?: number;
}
```

### Run Result

```typescript
interface RunValidationResult {
  passed: number;
  failed: number;
  drifts: RuntimeDrift[];
  installSuccess: boolean;
  installError?: string;
}

interface RuntimeDrift {
  exportName: string;
  exampleIndex: number;
  error: string;
  type: 'syntax-error' | 'runtime-error' | 'assertion-failed';
}
```

## Example Format

Standard `@example` JSDoc:

```typescript
/**
 * Adds two numbers.
 *
 * @example
 * ```ts
 * const result = add(1, 2);
 * console.log(result); // 3
 * ```
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

### With Assertions

```typescript
/**
 * @example
 * ```ts
 * const result = add(1, 2);
 * // Expected: 3
 * assert(result === 3);
 * ```
 */
```

## Pipeline

1. **presence** - Count exports with/without examples
2. **typecheck** - Compile examples with TypeScript
3. **run** - Execute in sandbox, check assertions

## Sandbox Execution

Examples run in isolated environment:
- Fresh node_modules install
- Package linked for imports
- Timeout enforcement
- Output capture

```typescript
// Example code transformed to:
import { add } from '@myorg/core';
const result = add(1, 2);
// Assertions checked...
```
