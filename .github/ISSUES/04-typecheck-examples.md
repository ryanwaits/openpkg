# `--typecheck-examples`: Static Type Validation for Examples

**Priority:** P4
**Phase:** 10C
**Labels:** `enhancement`, `cli`, `sdk`

## Summary

Add a flag to type-check `@example` code blocks without executing them. Faster than `--run-examples` and catches type errors early.

## Proposed CLI

```bash
# Type check examples only
doccov check --typecheck-examples

# Combined: type check + run
doccov check --typecheck-examples --run-examples
```

## New Drift Type

```typescript
type: 'example-type-error'
target: 'example[0]:line5'
issue: "Type 'string' is not assignable to type 'number'"
suggestion: 'Fix the type error in the example code'
```

## Implementation

### SDK Changes

```typescript
// packages/sdk/src/analysis/example-typechecker.ts

export interface ExampleTypeError {
  exampleIndex: number;
  line: number;
  column: number;
  message: string;
  code: number; // TS error code
}

export function typecheckExamples(
  examples: string[],
  packagePath: string,
): Promise<ExampleTypeError[]>;
```

### How It Works

1. Create virtual source file with example code
2. Add imports from the package being documented
3. Run `ts.getPreEmitDiagnostics()` on virtual file
4. Map errors back to original example line numbers
5. Report as `example-type-error` drift

### Performance

- No npm install needed (unlike `--run-examples`)
- Uses in-memory TypeScript compiler
- Can reuse tsconfig from project
- ~10x faster than runtime execution

## Example Output

```
$ doccov check --typecheck-examples

Checking examples...

✗ createClient (src/client.ts)
  @example block 1, line 3:
    Type 'string' is not assignable to parameter of type 'number'

  @example block 2: ✓

Found 1 example type error
```

## Acceptance Criteria

- [ ] `--typecheck-examples` flag added to `check` command
- [ ] SDK `typecheckExamples()` function implemented
- [ ] `example-type-error` drift type added to spec
- [ ] Error line numbers map back to original JSDoc
- [ ] Works with package imports in examples
- [ ] Respects project tsconfig.json
