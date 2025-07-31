# Build Detection and Smart Warnings

OpenPkg includes intelligent build detection to help ensure you get complete type information in your generated specifications.

## How It Works

When you run `openpkg generate`, the CLI automatically checks for:

1. **Missing node_modules** - Dependencies not installed
2. **Missing build output** - TypeScript not compiled
3. **Monorepo structure** - Workspace packages not built
4. **Workspace dependencies** - Local packages not linked

## Example Scenarios

### Fresh Clone Warning
```bash
git clone https://github.com/org/typescript-monorepo
cd typescript-monorepo/packages/core
openpkg generate

# Output:
⚠️  Build recommended for complete type extraction

Suggestions:
  • Run `npm install` (or yarn/pnpm/bun install) to install dependencies
  • Run `npm run build` at the monorepo root to build all packages
  • This package uses workspace dependencies that need to be built first

This ensures all dependencies and types can be resolved.
Continue anyway? Some type information may be incomplete.

Continue? (y/N): 
```

### After Install but Before Build
```bash
npm install
openpkg generate

# Output:
⚠️  Build recommended for complete type extraction

Suggestions:
  • Run `npm run build` to compile TypeScript and generate type declarations

This ensures all dependencies and types can be resolved.
Continue anyway? Some type information may be incomplete.

Continue? (y/N):
```

## Skipping the Check

If you know what you're doing or are analyzing a simple file without dependencies:

```bash
# Skip build warnings
openpkg generate --skip-build-check

# Or for a simple file that doesn't need building
openpkg generate simple-utils.ts --skip-build-check
```

## What Gets Checked

### 1. Package Dependencies
- Looks for `node_modules` folder
- Suggests `npm install` if missing

### 2. Build Output
- Checks for `dist/` or `lib/` folders
- Detects if package.json has a `build` script
- Suggests running build if output is missing

### 3. Monorepo Detection
- Checks if current package is in a workspace
- Looks for parent package.json with workspaces
- Suggests building at monorepo root

### 4. Workspace Protocol
- Detects `workspace:*` dependencies
- Warns that local packages need building

## Best Practices

### For Best Results
Always build before running OpenPkg:
```bash
npm install
npm run build
openpkg generate
```

### For Simple Files
Skip the check for standalone files:
```bash
openpkg generate utils/helpers.ts --skip-build-check
```

### For CI/CD
Always skip in automated environments:
```bash
# In your CI script
npm ci
npm run build
openpkg generate --skip-build-check
```

## Understanding the Impact

### With Proper Build
- ✅ All imports resolved
- ✅ Complete type information
- ✅ Cross-package references work
- ✅ Full JSDoc extraction

### Without Build
- ⚠️ Import errors for local packages
- ⚠️ Missing type information
- ⚠️ Generic `any` types
- ⚠️ Incomplete specifications

The build detection helps ensure you get the most accurate and complete OpenPkg specifications possible!