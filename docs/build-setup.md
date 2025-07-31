# OpenPkg Build Setup

## Overview

OpenPkg uses **bunup** for building and bundling, providing blazing-fast builds with ESM-only output.

## Key Build Decisions

### 1. **ESM-Only**
- No CommonJS support - modern ESM modules only
- Package type is set to `"module"` in package.json
- All imports/exports use ESM syntax

### 2. **Bunup Configuration**
The build is configured via `bunup.config.ts`:

```typescript
{
  entry: ['src/index.ts', 'src/cli.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node',
  declaration: true,  // Generates .d.ts files
  clean: true,        // Cleans dist before build
  external: [...]     // Dependencies not bundled
}
```

### 3. **Build Output**
- **Location**: `dist/` folder (gitignored)
- **Files**:
  - `index.js` - Main library entry
  - `cli.js` - CLI executable (with shebang)
  - `*.d.ts` - TypeScript declarations
  - `shared/` - Optimized shared chunks

### 4. **External Dependencies**
The following are marked as external and not bundled:
- `commander` - CLI framework
- `typescript` - Type extraction
- `zod` - Schema validation
- Node.js built-ins (`fs`, `path`, `url`)

## Build Commands

### Production Build
```bash
bun run build
```
- Cleans dist folder
- Builds all entry points
- Generates TypeScript declarations
- ~250ms build time

### Development Build
```bash
bun run dev
```
- Watches for changes
- Rebuilds automatically
- Great for iterative development

### Running CLI in Development
```bash
bun run cli -- generate [options]
```
- Runs TypeScript directly via Bun
- No build step needed

## Package.json Configuration

Key ESM-related settings:
```json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

## Why Bunup?

1. **Speed**: Sub-second builds (256ms for OpenPkg)
2. **Simplicity**: Minimal configuration needed
3. **ESM-First**: Perfect for modern packages
4. **Bun Integration**: Leverages Bun's speed
5. **TypeScript**: Built-in declaration generation

## Distribution

The `dist/` folder contains everything needed for npm publishing:
- ESM JavaScript files
- TypeScript declarations
- Executable CLI with proper shebang
- Optimized shared chunks

Users install via npm/yarn/bun and get a fully typed, ESM-only package.