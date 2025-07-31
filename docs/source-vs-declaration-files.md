# Source Files vs Declaration Files: How OpenPkg Works

## Overview

OpenPkg uses the TypeScript Compiler API to extract type information from your packages. Understanding how it works with different file types helps you get the most complete and accurate specifications.

## File Type Priority

OpenPkg looks for files in this order:
1. **Source files** (`.ts`) - Preferred when available
2. **Declaration files** (`.d.ts`) - Used when source isn't available
3. **JavaScript files** (`.js`) - As a last resort with limited type info

### Why Source Files Are Preferred

Source files contain:
- Complete JSDoc/TSDoc comments
- Full implementation context
- Richer type information
- Inline documentation that may be stripped from `.d.ts`

```typescript
// In source.ts - Full documentation preserved
/**
 * Processes user data with validation
 * @param data - The user data to process
 * @param options - Processing options
 * @returns Processed user object
 * @example
 * ```ts
 * const user = processUser({ name: "John" }, { validate: true });
 * ```
 */
export function processUser(data: UserInput, options?: ProcessOptions): User {
  // Implementation details help with type inference
}

// In declaration.d.ts - Some info may be lost
export declare function processUser(data: UserInput, options?: ProcessOptions): User;
```

## How Module Resolution Works

### 1. Simple File Analysis
When you point directly to a file, OpenPkg:
- Loads that single file
- Resolves types defined within it
- Works immediately without setup

```bash
# Direct file - no dependencies needed
openpkg generate utils/helpers.ts
```

### 2. Package Analysis
When analyzing a package, OpenPkg:
- Finds the entry point from package.json
- Creates a TypeScript program
- Attempts to resolve ALL imports
- Needs dependencies to be available

```typescript
// If your code has imports...
import { NetworkClient } from '@myorg/network';  // ← Must be resolvable
import { helperFn } from './utils';              // ← Must exist
import type { Config } from 'external-package';  // ← Must be installed
```

## The Build Step: When and Why

### When You DON'T Need to Build

✅ **Standalone files** with no external imports
```typescript
// math.ts - self-contained
export function add(a: number, b: number): number {
  return a + b;
}
```

✅ **Using published packages** from npm
```typescript
// Already built and published
import { z } from 'zod';  // Works if 'zod' is in node_modules
```

### When You NEED to Build

❌ **Monorepo packages** before linking
```typescript
// @myorg/utils hasn't been built yet
import { Helper } from '@myorg/utils';  // TypeScript can't find this
```

❌ **Local packages** with TypeScript source
```typescript
// Importing from TypeScript source that needs compilation
import { Client } from '../other-package/src';
```

## What Happens During Build

### 1. TypeScript Compilation
```bash
tsc
# or
npm run build
```
- Compiles `.ts` → `.js`
- Generates `.d.ts` type declarations
- Outputs to `dist/` or `lib/`

### 2. Monorepo Workspace Linking
In monorepos, the build process often:
```json
// package.json in workspace
{
  "name": "@myorg/network",
  "types": "dist/index.d.ts",  // ← Build creates this
  "main": "dist/index.js"
}
```

### 3. Symlink Creation
Build tools create symlinks:
```
node_modules/
  @myorg/
    network → ../../packages/network  # Symlink to local package
```

## Complete Example: Analyzing stacks.js

Let's trace through what happens:

### Without Build (Incomplete)
```bash
git clone https://github.com/hirosystems/stacks.js
cd stacks.js/packages/transactions
openpkg generate

# Result: Missing types from @stacks/network, @stacks/common, etc.
```

**What happens:**
1. OpenPkg reads `src/index.ts`
2. Finds `import { StacksNetwork } from '@stacks/network'`
3. TypeScript can't resolve `@stacks/network` - not in node_modules
4. Type is marked as `any` or spec generation fails

### With Build (Complete)
```bash
git clone https://github.com/hirosystems/stacks.js
cd stacks.js
npm install        # Install external dependencies
npm run build      # Build all workspace packages
cd packages/transactions
openpkg generate

# Result: Complete spec with all types resolved
```

**What happens:**
1. Build compiles all packages
2. Creates symlinks in node_modules
3. OpenPkg reads `src/index.ts`
4. Finds `import { StacksNetwork } from '@stacks/network'`
5. TypeScript resolves to `node_modules/@stacks/network`
6. Reads type info from `@stacks/network/dist/index.d.ts`
7. Complete type information in spec!

## Best Practices

### For Package Authors
```bash
# Before running OpenPkg on your package:
npm install      # Ensure dependencies exist
npm run build    # Build if you have local dependencies
openpkg generate # Generate complete spec
```

### For Monorepo Packages
```bash
# At monorepo root:
npm install
npm run build    # Usually builds all packages

# Then for specific package:
openpkg generate --package @myorg/specific-package
```

### For Simple Scripts
```bash
# No build needed for standalone files:
openpkg generate my-utils.ts
```

## Troubleshooting

### "Cannot find module" Errors
**Problem**: TypeScript can't resolve imports
**Solution**: Run `npm install` and `npm run build`

### Missing Type Information
**Problem**: Types show as `any` or are missing
**Solution**: Ensure dependencies are built and available

### Incomplete JSDoc
**Problem**: Documentation is missing
**Solution**: Use source files (.ts) instead of declaration files (.d.ts) when possible

## Summary

- **Source files** (.ts) provide the richest information
- **Build steps** ensure all dependencies are resolvable
- **Monorepos** especially need building to link workspace packages
- **Simple files** work without any build process

Understanding these concepts helps you get complete, accurate OpenPkg specifications with full type information and documentation.