# Changelog

All notable changes to OpenPkg will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2024-01-29

### 🎉 Major Release: TypeScript Compiler API Integration

This release represents a complete refactoring of OpenPkg's core type resolution engine, moving from ts-morph to the TypeScript Compiler API for more powerful and accurate type analysis.

### Added

#### Core Features
- **TypeScript Compiler API Integration**: Complete refactor from ts-morph to TypeScript Compiler API
- **Full Type Resolution**: Automatically expand and resolve complex types without AI assistance
  - Generic type expansion (e.g., `Partial<User>` → full property list)
  - Utility type resolution (`Required<T>`, `Pick<T, K>`, `Omit<T, K>`, etc.)
  - Conditional type evaluation
  - Mapped type expansion
  - Cross-file type resolution
- **Enhanced Type Analysis**:
  - Type hierarchy visualization with `--include-type-hierarchy`
  - Resolved type information with `--include-resolved-types`
  - JSDoc extraction with support for all tags (@example, @since, @deprecated, etc.)
  - Type inference detection
  - Symbol resolution and declaration merging

#### Performance Improvements
- **21-66% faster** than ts-morph implementation
- **Intelligent caching system** for type resolution
- **Warm-up optimization** for common types
- **Incremental type resolution** support

#### Developer Experience
- **Verbose mode** (`-v, --verbose`) for debugging
  - Detailed logging of type resolution steps
  - Cache hit/miss statistics
  - Performance timing information
  - Progress indicators for large codebases
- **Enhanced error messages** with helpful context and suggestions
  - Common TypeScript errors explained
  - Resolution suggestions for each error type
  - Formatted error locations
- **Comprehensive documentation**:
  - API documentation (API.md)
  - Usage examples (examples/README.md)
  - Migration guide (MIGRATION-GUIDE.md)
  - Limitations and workarounds (LIMITATIONS.md)

### Changed

#### Breaking Changes
- **TypeScript Compiler API is now the default** (was ts-morph)
  - Use `--use-legacy-parser` to use the old ts-morph parser
- **AI enhancement is now optional** (was integrated)
  - Use `--enhance-with-ai` to enable AI features
  - Separate flags for AI examples (`--ai-examples`) and descriptions (`--ai-descriptions`)
- **Minimum TypeScript version**: Now requires TypeScript 5.0+

#### CLI Changes
- Renamed `--depth` to `--max-depth` for type resolution depth control
- Added `--include-resolved-types` flag (replaces automatic AI resolution)
- Added `--include-type-hierarchy` flag for inheritance visualization
- Added `-v, --verbose` flag for detailed debugging output

### Fixed
- **Readonly property detection** in mapped types
- **Nested array type resolution** (e.g., `Array<Array<string>>`)
- **Tuple type detection** with multiple fallback strategies
- **JSDoc extraction** for @example and @since tags
- **Module resolver parameter order** issues
- **Circular type reference handling** with proper cycle detection

### Deprecated
- `--depth` flag (use `--max-depth` instead)
- Direct AI integration (use `--enhance-with-ai` for opt-in AI features)

### Known Limitations
- Deeply recursive types (>100 levels) may cause stack overflow
- Complex circular references may not fully resolve
- Limited support for ambient module declarations
- Triple-slash directives have limited support

## [1.0.0] - 2024-01-01

### Initial Release
- Basic TypeScript parsing with ts-morph
- AI-powered type resolution
- Function and type extraction
- Basic JSDoc support
- CLI interface
- JSON output format

## Future Roadmap

### [2.1.0] - Planned
- **Watch mode** for incremental updates
- **Better circular type reference handling**
- **Complex generic constraint support**
- **Declaration file (.d.ts) support**
- **Triple-slash directive support**

### [2.2.0] - Planned
- **Language Server Protocol (LSP) integration**
- **Real-time type resolution API**
- **Plugin system for custom type handlers**
- **Multiple output format support** (YAML, TOML, etc.)

---

For more information about migrating from v1.x to v2.0, see [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md).