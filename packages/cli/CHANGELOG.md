# @doccov/cli

## 0.11.0

### Minor Changes

- Version sync release

### Patch Changes

- Updated dependencies
  - @doccov/sdk@0.11.0

## 0.10.2

### Patch Changes

- Update @doccov/sdk dependency to include monorepo entry point path fix

## 0.10.0

### Minor Changes

- ### @openpkg-ts/spec

  **Breaking (pre-1.0):** Restructured spec types to move coverage metadata to an enrichment layer:

  - Removed `docs` field from `SpecExport` and `OpenPkg` types (now provided via SDK enrichment)
  - Changed `SpecDocsMetadata.missing` from `SpecDocSignal[]` to `string[]` (now uses rule IDs)
  - Added `DriftType` as a standalone exported type
  - Added `DriftCategory` type with three categories: `structural`, `semantic`, `example`
  - Added `DRIFT_CATEGORIES` mapping, `DRIFT_CATEGORY_LABELS`, and `DRIFT_CATEGORY_DESCRIPTIONS` constants for categorizing and displaying drift issues

  ### @doccov/sdk

  **Breaking (pre-1.0):** Replaced the lint module with a new quality rules engine and added spec-level caching:

  - Removed the `lint` module (`LintConfig`, `LintRule`, `lintExport`, `lintExports`, etc.)
  - Added `quality` module with a flexible rules-based engine:
    - `QualityRule`, `QualityViolation`, `QualityConfig` types
    - `evaluateQuality()`, `evaluateExportQuality()` functions
    - Built-in rules: `CORE_RULES`, `STYLE_RULES`, `BUILTIN_RULES`
  - Added `cache` module for spec-level caching:
    - `loadSpecCache()`, `saveSpecCache()`, `validateSpecCache()`
    - `hashFile()`, `hashFiles()`, `hashString()` utilities
  - Added enrichment layer:
    - `enrichSpec()` function
    - `EnrichedExport`, `EnrichedOpenPkg`, `EnrichedDocsMetadata` types
  - Added unified report generation:
    - `generateReport()`, `generateReportFromEnriched()`
    - `DocCovReport`, `CoverageSummary`, `DriftReport` types
  - Added unified example validation:
    - `validateExamples()` function
    - `parseExamplesFlag()`, `shouldValidate()` utilities
    - `ExampleValidationResult`, `ExampleValidationOptions` types

  ### @doccov/cli

  **Breaking (pre-1.0):** Revamped commands for better UX and added multi-format reporting:

  - Renamed `generate` command to `spec` (generates OpenPkg spec files)
  - Added `info` command for quick package summary (exports, coverage, drift at a glance)
  - Revamped `check` command:
    - Removed options: `--require-examples`, `--exec`, `--no-lint`, `--no-typecheck`, `--ignore-drift`
    - Added options: `--examples [mode]` (presence, typecheck, run), `--max-drift <percentage>`, `--format <format>`, `-o/--output <file>`, `--stdout`, `--no-cache`
    - Now supports multi-format output: text, json, markdown, html, github
    - Writes reports to `.doccov/` directory by default
  - Added spec-level caching (use `--no-cache` to bypass)
  - Simplified config schema to match new quality rules engine

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.8.0
  - @doccov/sdk@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.9.0
  - @openpkg-ts/spec@0.7.0

## 0.8.0

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.8.0
  - @openpkg-ts/spec@0.6.0

## 0.7.0

### Minor Changes

- consolidate cli by removing lint, report, and typecheck commands (now in SDK). simplify check, generate, and scan commands to use unified SDK modules.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.5.0
  - @doccov/sdk@0.7.0

## 0.6.0

### Patch Changes

- update command implementations and config
- Updated dependencies
- Updated dependencies
  - @doccov/sdk@0.6.0
  - @openpkg-ts/spec@0.4.1

## 0.5.8

### Patch Changes

- feat: add lint and typechecking commands
- Updated dependencies
  - @doccov/sdk@0.5.8

## 0.5.7

### Patch Changes

- show holistic documentation coverage percentage in diff output
- Updated dependencies
- Updated dependencies
  - @openpkg-ts/spec@0.4.0
  - @doccov/sdk@0.5.7

## 0.5.6

### Patch Changes

- enhance diff command output with member-level changes section and method-level targeting in docs impact
- Updated dependencies
  - @doccov/sdk@0.5.6

## 0.5.4

### Patch Changes

- bug(cli): do not check for doccov config in `diff` when no `--docs` flag is supplied

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
