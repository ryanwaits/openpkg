# OpenPkg Limitations and Workarounds

This document outlines known limitations of OpenPkg when using the TypeScript Compiler API and provides workarounds where available.

## Table of Contents
- [Type Resolution Limitations](#type-resolution-limitations)
- [Performance Limitations](#performance-limitations)
- [Feature Limitations](#feature-limitations)
- [Workarounds and Best Practices](#workarounds-and-best-practices)

## Type Resolution Limitations

### 1. Deeply Recursive Types

**Limitation**: Types with extreme recursion depth (>100 levels) may cause stack overflow errors.

**Example**:
```typescript
// This may cause issues
type InfiniteNested<T> = {
  value: T;
  next: InfiniteNested<InfiniteNested<T>>;
};
```

**Workaround**:
- Use the `--max-depth` flag to limit recursion (default: 5)
- Restructure types to reduce nesting depth
- Consider using type aliases to break recursion

```bash
# Limit recursion depth
openpkg src/types.ts --max-depth 3
```

### 2. Circular Type References

**Limitation**: Complex circular references between types may not fully resolve.

**Example**:
```typescript
interface A {
  b: B;
  self: A;
}

interface B {
  a: A;
  c: C;
}

interface C {
  a: A;
  b: B;
}
```

**Workaround**:
- The type walker includes cycle detection to prevent infinite loops
- Circular references are noted but not fully expanded
- Use `--verbose` to see where cycles are detected

### 3. Conditional Type Complexity

**Limitation**: Very complex conditional types with multiple levels of inference may not fully resolve.

**Example**:
```typescript
type DeepInfer<T> = T extends Promise<infer U>
  ? U extends Array<infer V>
    ? V extends Record<string, infer W>
      ? W
      : V
    : U
  : T;
```

**Workaround**:
- Simplify conditional types where possible
- Use intermediate type aliases
- The resolver will show the conditional type structure even if not fully resolved

## Performance Limitations

### 1. Large Codebase Processing

**Limitation**: Processing codebases with >10,000 files may be slow on initial run.

**Workaround**:
- Use file filtering to process only needed files
- Enable caching (enabled by default)
- Process in batches for very large projects

```bash
# Process specific directories
openpkg src/core/**/*.ts --output core-api.json
openpkg src/utils/**/*.ts --output utils-api.json
```

### 2. Memory Usage

**Limitation**: Type resolution for very large type hierarchies can consume significant memory.

**Workaround**:
- Reduce `--max-depth` for memory-constrained environments
- Process files individually rather than entire projects
- Use `--no-cache` if memory is more critical than performance

### 3. Complex Union Types

**Limitation**: Unions with >100 members may impact performance.

**Example**:
```typescript
type LargeUnion = 'a' | 'b' | 'c' | ... // 100+ members
```

**Workaround**:
- Consider using enums for large string unions
- Group related union members into sub-types
- Use type generation for repetitive patterns

## Feature Limitations

### 1. Declaration Files (.d.ts)

**Limitation**: Limited support for ambient module declarations and global augmentations.

**Example**:
```typescript
// May not fully resolve
declare module 'external-lib' {
  export function doSomething(): void;
}
```

**Workaround**:
- Include actual implementation files when possible
- Use `--include-resolved-types` for better declaration handling
- Manually specify type information for external modules

### 2. Dynamic Type Generation

**Limitation**: Cannot resolve types that are generated at runtime.

**Example**:
```typescript
// Runtime-generated types won't be resolved
const dynamicType = createTypeAtRuntime();
type DynamicType = typeof dynamicType;
```

**Workaround**:
- Use static type definitions where possible
- Generate type files as part of build process
- Document dynamic type patterns separately

### 3. Triple-Slash Directives

**Limitation**: Limited support for `/// <reference>` directives.

**Example**:
```typescript
/// <reference types="node" />
/// <reference path="./types.d.ts" />
```

**Workaround**:
- Use standard ES6 imports instead
- Include referenced files in the file list
- Ensure tsconfig.json includes all necessary type roots

### 4. Complex Mapped Type Keys

**Limitation**: Some complex mapped type key manipulations may not fully resolve.

**Example**:
```typescript
type ComplexMapped<T> = {
  [K in keyof T as `${string & K}${Capitalize<string & K>}`]: T[K]
};
```

**Workaround**:
- The structure will be shown even if key names aren't fully resolved
- Use simpler key transformations where possible
- Add explicit type annotations for clarity

## Workarounds and Best Practices

### 1. Using Legacy Parser Fallback

For types that cause issues with the Compiler API:

```bash
# Use legacy ts-morph parser
openpkg src/problem-file.ts --use-legacy-parser
```

### 2. Incremental Processing

For large projects, process incrementally:

```bash
# Process core types first
openpkg src/types/index.ts --output types.json

# Then process implementations
openpkg src/impl/index.ts --output impl.json
```

### 3. Custom TSConfig

Use a custom tsconfig for better control:

```json
// openpkg.tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true,
    "maxNodeModuleJsDepth": 2
  }
}
```

```bash
# Use custom config
OPENPKG_TSCONFIG=openpkg.tsconfig.json openpkg src/index.ts
```

### 4. Debugging Type Resolution

Use verbose mode to debug issues:

```bash
# Enable verbose output
openpkg src/complex-types.ts --verbose

# Check cache statistics
openpkg src/index.ts --verbose | grep "Cache"
```

### 5. Handling External Dependencies

For better external type resolution:

1. Install type definitions:
```bash
npm install --save-dev @types/node @types/react
```

2. Include in tsconfig.json:
```json
{
  "compilerOptions": {
    "types": ["node", "react"]
  }
}
```

3. Use full imports for clarity:
```typescript
// Instead of
import React from 'react';

// Use
import * as React from 'react';
```

## Reporting Issues

If you encounter limitations not covered here:

1. Check if using latest version: `openpkg --version`
2. Try with `--verbose` flag for more information
3. Test with a minimal reproduction
4. Report at: https://github.com/anthropics/claude-code/issues

Include:
- OpenPkg version
- TypeScript version
- Minimal code example
- Error message or unexpected output
- Any workarounds attempted

## Future Improvements

We're actively working on:
- Better recursive type handling
- Improved memory management for large projects
- Enhanced declaration file support
- Watch mode for incremental updates
- Better error messages and recovery

Check the [CHANGELOG.md](./CHANGELOG.md) for updates on these improvements.