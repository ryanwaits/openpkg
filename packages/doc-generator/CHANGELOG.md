# @openpkg-ts/doc-generator

## 0.2.2

### Patch Changes

- Add Fumadocs virtual source and loader plugin for seamless integration

## 0.2.1

### Patch Changes

- fix: export new styled components from react-styled entry

## 0.2.0

### Minor Changes

- feat(doc-generator): add AI SDK-style API reference components

  - Add CodeTabs: tabbed code blocks with copy button
  - Add ExportCard: clickable cards for export index grid
  - Add ExportIndexPage: category-grouped exports grid
  - Add ImportSection: copyable import statement display
  - Add ParameterItem: expandable nested params display
  - Update FunctionPage with improved layout
  - Update APIPage to support index mode
  - Add CSS vars for new components

## 0.1.2

### Patch Changes

- fix: separate server/client builds to prevent node:module error in Turbopack

## 0.1.1

### Patch Changes

- fix @openpkg-ts/spec dependency to use published version

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
  - @openpkg-ts/spec@0.11.1

## 0.0.1

### Initial Release

- **Core API**: `createDocs()`, `loadSpec()` for loading OpenPkg specs
- **Query utilities**: `formatSchema()`, `buildSignatureString()`, member filtering and sorting
- **Renderers**: Markdown/MDX, HTML, JSON output formats
- **Navigation**: Fumadocs, Docusaurus, and generic nav generation
- **Search**: Pagefind and Algolia compatible indexes
- **React components**: Headless (unstyled) and styled (Tailwind v4) variants
- **CLI**: `generate`, `build`, `dev` commands
- **Adapter architecture**: Extensible framework integration pattern
