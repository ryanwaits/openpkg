# OpenPkg Examples

This directory contains various TypeScript examples to test OpenPkg's analysis capabilities, particularly the import resolution features.

### Running locally

```bash
# from repo root
bun run build:cli
node packages/cli/dist/cli.js generate simple-math.ts --cwd examples --output simple-math.json
```

Each scenario below lists the CLI command needed to analyze it locally (no GitHub fetch required).

## Examples for Phase 1.4 (Import Resolution)

### 1. blog-api/
**Tests**: Basic relative imports with clean dependency structure
- Simple relative imports (`./types`, `./utils`)
- Type references across files
- Clean, no circular dependencies

```bash
# from repo root after building the CLI
node packages/cli/dist/cli.js generate blog-api/main.ts --cwd examples --output blog-api.json
```

### 2. circular-deps/
**Tests**: Circular dependency handling
- File A imports from file B
- File B imports from file A
- Tests cycle detection and prevention

```bash
node packages/cli/dist/cli.js generate circular-deps/a.ts --cwd examples --output circular.json
```

**Expected Output Comparison:**

Without `--follow=imports`:
- Only includes types from `a.ts` (`AData` and `A` class)
- Has broken reference to `BData` that doesn't exist in types array
- Results in incomplete spec with unresolved type references

With `--follow=imports`:
- Includes all types from both files:
  - From `a.ts`: `AData` interface, `A` class
  - From `b.ts`: `BData` interface, `B` class
- All circular references are properly resolved:
  - `AData.b` → `BData` (resolved)
  - `BData.aRef` → `A` (resolved)
- Complete, self-contained specification

**Key Difference**: The types array should contain 4 types instead of 2, ensuring all `$ref` references can be resolved.

### 3. deep-imports/
**Tests**: Complex directory structures and parent imports
- Multiple levels of nesting (`../../utils/logger`)
- Parent directory imports (`../shared/utils`)
- Deep dependency chains (index → services → database)
- Max depth limiting

```bash
node packages/cli/dist/cli.js generate deep-imports/index.ts --cwd examples --output deep-imports.json
```

**Expected Output Comparison:**

Without `--follow=imports`:
- Only includes the `Application` class from index.ts
- 1 type total
- Missing all dependencies

With `--follow=imports --max-depth=3`:
- Includes all types from the dependency tree:
  - From `index.ts`: `Application` class
  - From `services/core.ts`: `CoreService` class  
  - From `../shared/utils.ts`: `SharedUtil` class (parent directory)
  - From `config/app.config.ts`: `AppConfig` interface
  - From `services/database/db-service.ts`: `DatabaseConfig` interface, `DatabaseService` class
  - From `utils/logger.ts`: `Logger` class
- 7 types total
- Successfully resolves:
  - Deep nested paths (services/database/)
  - Parent directory imports (../shared/)
  - Multi-level dependency chains

**Key Difference**: Should have 7 types instead of 1, demonstrating deep import resolution across complex directory structures.

### 4. barrel-exports/
**Tests**: Re-exports and barrel files
- `export * from './models'` - re-export all
- `export { specific } from './file'` - selective re-export
- `export type { Type } from './types'` - type-only re-export
- Tests if analyzer follows re-exports correctly

```bash
node packages/cli/dist/cli.js generate barrel-exports/index.ts --cwd examples --output barrel.json
```

**Expected Output Comparison:**

Without `--follow=imports`:
- 0 exports (barrel file has no direct exports)
- 0 types
- Empty spec

With `--follow=imports` (✅ fully working):
- 5 exports (3 classes, 2 functions)
- 7 types (3 interfaces, 1 type alias, 3 classes)
- All re-exports properly analyzed and categorized

**Final Implementation Status**: 
- ✅ Re-exports are recognized and followed
- ✅ Types from imported files are collected
- ✅ Runtime exports (functions/classes) added to exports array
- ✅ Type-only constructs (interfaces/types) only in types array
- ✅ Type-only export syntax (`export type`) properly handled

**Exports Array Contains**:
- ✅ `UserModel` class
- ✅ `UserService`, `PostService` classes
- ✅ `validateUser`, `validatePost` functions

**Types Array Contains**:
- ✅ `User`, `Post`, `ValidationResult` interfaces
- ✅ `ValidatorFunction` type alias
- ✅ All classes (dual nature as both runtime and type)

### 5. mixed-imports/
**Tests**: Various import styles and non-TS files
- `import type` - type-only imports
- `import * as namespace` - namespace imports
- `import json from './config.json'` - JSON imports (should be skipped)
- Different import syntaxes in one file

```bash
node packages/cli/dist/cli.js generate mixed-imports/calculator.ts --cwd examples --output mixed-imports.json
```

**Expected Output Comparison:**

Without `--follow=imports`:
- 1 export: Calculator class
- 1 type: Calculator class
- Only analyzes the main file

With `--follow=imports` (✅ working):
- 1 export: Calculator class (same)
- 4 types total:
  - Calculator class (from main file)
  - Operation interface (from types.ts via `import type`)
  - OperationType type alias (from types.ts)
  - CalculatorConfig interface (from types.ts)

**Test Results**:
- ✅ Type-only imports are followed
- ✅ Regular imports are followed
- ✅ Namespace imports are followed
- ✅ JSON imports are correctly skipped
- ✅ All types from imported TS files are collected

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
node packages/cli/dist/cli.js generate blog-api/main.ts --cwd examples --output blog-api.json

# Circular dependency test
node packages/cli/dist/cli.js generate circular-deps/a.ts --cwd examples --output circular.json

# Deep nesting with max depth
node packages/cli/dist/cli.js generate deep-imports/index.ts --cwd examples --output deep.json

# Barrel exports
node packages/cli/dist/cli.js generate barrel-exports/index.ts --cwd examples --output barrel.json

# Mixed imports
node packages/cli/dist/cli.js generate mixed-imports/calculator.ts --cwd examples --output mixed.json
```
