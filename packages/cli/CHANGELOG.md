# @doccov/cli

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
