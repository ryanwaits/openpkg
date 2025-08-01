# OpenPkg Examples

This directory contains various TypeScript examples to test OpenPkg's analysis capabilities, particularly the import resolution features.

## Examples for Phase 1.4 (Import Resolution)

### 1. blog-api/
**Tests**: Basic relative imports with clean dependency structure
- Simple relative imports (`./types`, `./utils`)
- Type references across files
- Clean, no circular dependencies

```bash
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/blog-api/main.ts --follow=imports
```

### 2. circular-deps/
**Tests**: Circular dependency handling
- File A imports from file B
- File B imports from file A
- Tests cycle detection and prevention

```bash
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/circular-deps/a.ts --follow=imports
```

### 3. deep-imports/
**Tests**: Complex directory structures and parent imports
- Multiple levels of nesting (`../../utils/logger`)
- Parent directory imports (`../shared/utils`)
- Deep dependency chains (index → services → database)
- Max depth limiting

```bash
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/deep-imports/index.ts --follow=imports --max-depth=3
```

### 4. barrel-exports/
**Tests**: Re-exports and barrel files
- `export * from './models'` - re-export all
- `export { specific } from './file'` - selective re-export
- `export type { Type } from './types'` - type-only re-export
- Tests if analyzer follows re-exports correctly

```bash
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/barrel-exports/index.ts --follow=imports
```

### 5. mixed-imports/
**Tests**: Various import styles and non-TS files
- `import type` - type-only imports
- `import * as namespace` - namespace imports
- `import json from './config.json'` - JSON imports (should be skipped)
- Different import syntaxes in one file

```bash
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/mixed-imports/calculator.ts --follow=imports
```

## What Each Example Validates

### Circular Dependencies (circular-deps/)
- ✓ Resolver detects cycles and prevents infinite loops
- ✓ Both files are still analyzed
- ✓ Types from both files are included
- ✓ No duplicate analysis of the same file

### Deep Nesting (deep-imports/)
- ✓ Correct path resolution for `../../` imports
- ✓ Handles imports from outside the root directory
- ✓ Respects max depth limits
- ✓ Resolves long dependency chains

### Barrel Exports (barrel-exports/)
- ✓ Follows re-exported modules
- ✓ Handles selective re-exports
- ✓ Processes type-only re-exports
- ✓ Doesn't lose type information through re-exports

### Mixed Import Styles (mixed-imports/)
- ✓ Handles type-only imports correctly
- ✓ Processes namespace imports
- ✓ Skips non-TypeScript files (JSON)
- ✓ Works with various import syntaxes

## Expected Behaviors

1. **Without --follow=imports**: Only the root file is analyzed, type references may be undefined
2. **With --follow=imports**: All TypeScript imports are resolved and their types are merged
3. **Circular deps**: Should complete without hanging, mentioning the cycle in logs
4. **Max depth**: Should stop at the specified depth, not analyzing files beyond it
5. **Non-TS files**: Should skip .json, .css, etc. files gracefully

## Testing Commands

Run all examples to verify import resolution:

```bash
# Basic test
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/blog-api/main.ts --follow=imports

# Circular dependency test
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/circular-deps/a.ts --follow=imports

# Deep nesting with max depth
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/deep-imports/index.ts --follow=imports --max-depth=2

# Barrel exports
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/barrel-exports/index.ts --follow=imports

# Mixed imports
openpkg analyze https://github.com/[user]/openpkg/blob/main/examples/mixed-imports/calculator.ts --follow=imports
```