# @doccov/api

## 0.3.6

### Patch Changes

- ### Execute Endpoint Fixes

  Fixed several issues with the `/execute` and `/execute-stream` endpoints when running in Vercel Sandbox:

  - **Path handling**: Added `normalizeCwd()` to properly handle working directory paths in the sandbox environment (`/vercel/sandbox/`)
  - **Local binary wrapping**: Added `wrapLocalBinary()` to automatically wrap devDependency tools (turbo, tsc, esbuild, vite, etc.) with the appropriate package manager exec command (npx, pnpm exec, bunx)
  - **Monorepo support**: Fixed entry point path stripping when targeting specific packages - paths like `packages/v0-sdk/src/index.ts` are now correctly resolved relative to the package root
  - **File reading**: Fixed `openpkg.json` read path to correctly locate the file in subdirectories when `rootPath` is set
  - **Cleanup**: Removed debug logging from production endpoints

  ### Documentation

  - Added "When to Use Which" section to execute endpoint docs
  - Clarified that the `package` parameter in `/plan` should be a directory path, not a package name
  - Added curl examples for streaming with summary output

## 0.3.5

### Patch Changes

- Updated dependencies [e063639]
  - @doccov/sdk@0.13.0
  - @openpkg-ts/spec@0.9.0

## 0.3.4

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.8.0

## 0.3.3

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.7.0

## 0.3.2

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.6.0

## 0.3.1

### Patch Changes

- consolidate api routes to use unified SDK modules.
- Updated dependencies
  - @openpkg-ts/spec@0.5.0

## 0.3.0

### Minor Changes

- add rate limiting middleware and job store abstractions

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.4.1

## 0.2.3

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.4.0

## 0.2.2

### Patch Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

## 0.2.1

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.3.0
