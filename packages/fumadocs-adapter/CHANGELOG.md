# @openpkg-ts/fumadocs-adapter

## 0.2.3

### Patch Changes

- fix: bump doc-generator dep for Turbopack compatibility

## 0.2.2

### Patch Changes

- fix package exports to point to dist/ instead of src/ for bundler compatibility

## 0.2.1

### Patch Changes

- version bump for republish

## 0.2.0

### Minor Changes

- Rename package from @doccov/fumadocs-adapter to @openpkg-ts/fumadocs-adapter

## 0.1.0

### Minor Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

### Patch Changes

- Updated dependencies
  - @openpkg-ts/doc-generator@0.1.0

## 0.0.3

### Patch Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

## 0.0.2

### Patch Changes

- update components and configuration
