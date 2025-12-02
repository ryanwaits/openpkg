# @doccov/cli

## 0.5.3

### Patch Changes

- chore(cli): cleanup progress feedback

## 0.5.2

### Patch Changes

- Fix spinner animation freezing during long-running operations by configuring ora with proper stdin handling and cursor management. Also update SDK dependency to ^0.3.7 to include latest fixes.

## 0.5.1

### Patch Changes

- chore: cleanup ux feedback and add err check for scanning private repos

## 0.5.0

### Minor Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.3.3

## 0.4.7

### Patch Changes

- Fix findPackageInMonorepo to check root package.json first, enabling analysis of repos where the main package is at the root (like zod)

## 0.4.6

### Patch Changes

- Fix monorepo package detection for pnpm workspaces by parsing pnpm-workspace.yaml

## 0.4.5

### Patch Changes

- Use improved entry point detection in generate command. When using `--cwd`, the CLI now correctly resolves `.d.ts` paths to source files and supports more project structures.

## 0.4.4

### Patch Changes

- Fix entry point detection to prefer .ts source files over .d.ts declarations. Scanning repos with `types` field pointing to `.d.ts` now correctly resolves to source files like `src/index.ts`.

## 0.4.0

### Minor Changes

- ## OpenPkg Spec Builder Improvements

  ### New Features

  - **Class inheritance**: Capture `extends` and `implements` clauses
  - **Namespace exports**: Support `export namespace X { ... }`
  - **Function overloads**: Capture all overload signatures
  - **Mapped/conditional types**: Preserve `tsType` for complex types
  - **External types**: Graceful handling with `kind: "external"` stubs
  - **Interface methods**: Serialize method signatures on interfaces
  - **Index signatures**: Capture `[key: string]: T` patterns
  - **Default values**: Preserve parameter defaults
  - **Rest parameters**: Mark with `rest: true`
  - **Getter/setter pairs**: Merge into single member
  - **Call/construct signatures**: Capture callable interfaces
  - **Type predicates**: Preserve `x is string` and `asserts x` returns
  - **Union discriminants**: Add `discriminator: { propertyName }` for tagged unions
  - **Re-export aliasing**: Correctly track `export { X as Y }`

  ### CLI Changes

  - Renamed `--no-external-types` to `--skip-resolve` across all commands
  - Added `--skip-resolve` to `report` and `scan` commands
  - New warnings for unresolved external types
  - Info message when `node_modules` not found

  ### Bug Fixes

  - Fixed circular type reference detection
  - Fixed destructured parameter TSDoc matching
  - Fixed drift detection for destructured params

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.3.0
  - @openpkg-ts/spec@0.3.0

## 0.3.0

### Minor Changes

- Add --ignore-drift flag to check command to allow drift detection without failing the check

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.2
  - @doccov/sdk@0.2.2

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.1
  - @doccov/sdk@0.2.1
