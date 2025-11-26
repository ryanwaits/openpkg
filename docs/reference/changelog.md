# Changelog

Release history for DocCov packages.

## v0.2.1 (Current)

Released packages:
- `@doccov/cli@0.2.1`
- `@doccov/sdk@0.2.1`
- `@openpkg-ts/spec@0.2.1`

### Features

- **Example Runner**: Execute `@example` blocks with `--run-examples`
- **Example Runtime Drift**: New `example-runtime-error` drift type
- **POST /api/examples/run**: API endpoint for code execution
- **Report Command**: `doccov report` generates markdown/html/json reports
- **Widget Endpoint**: Embeddable coverage breakdown widget
- **Leaderboard API**: Public rankings of library docs coverage

### Improvements

- SSE streaming for scan progress
- Auto-detect package manager (pnpm/bun/npm)
- Build step detection for monorepos
- LLM fallback for entry point detection

## v0.2.0

Major release with DocCov branding.

### Breaking Changes

- Renamed `@openpkg-ts/sdk` to `@doccov/sdk`
- Renamed `@openpkg-ts/cli` to `@doccov/cli`
- Binary renamed from `openpkg` to `doccov`
- Config file renamed from `openpkg.config.ts` to `doccov.config.ts`

### Features

- **Coverage Scoring**: Per-export and package-wide scores
- **Drift Detection**: 10 drift types
  - param-mismatch
  - param-type-mismatch
  - return-type-mismatch
  - generic-constraint-mismatch
  - optionality-mismatch
  - deprecated-mismatch
  - visibility-mismatch
  - example-drift
  - broken-link
  - example-runtime-error (v0.2.1)
- **Fuzzy Suggestions**: "Did you mean?" for misnamed params
- **Diff Command**: Compare specs with coverage delta
- **Scan Command**: Analyze remote GitHub repos
- **Badge API**: Shields.io-style coverage badges
- **GitHub Action**: CI/CD integration

### Schema

- Added `docs.coverageScore`
- Added `docs.missing[]`
- Added `docs.drift[]`
- Added `SpecDocDrift` type

## v0.1.0

Initial release as OpenPkg.

### Features

- TypeScript analysis
- OpenPkg JSON spec generation
- Basic validation
- Type reference system (`$ref`)

### Packages

- `@openpkg-ts/spec` - Schema and types
- `@openpkg-ts/sdk` - Analysis library
- `@openpkg-ts/cli` - Command-line interface

## Package Changelogs

Individual package changelogs:

- [CLI Changelog](https://github.com/doccov/doccov/blob/main/packages/cli/CHANGELOG.md)
- [SDK Changelog](https://github.com/doccov/doccov/blob/main/packages/sdk/CHANGELOG.md)
- [Spec Changelog](https://github.com/doccov/doccov/blob/main/packages/spec/CHANGELOG.md)

## GitHub Releases

Full release notes on GitHub:

https://github.com/doccov/doccov/releases

## Migration Guides

### 0.1.x to 0.2.x

1. Update package names:
   ```bash
   npm uninstall @openpkg-ts/sdk @openpkg-ts/cli
   npm install @doccov/sdk @doccov/cli
   ```

2. Update imports:
   ```typescript
   // Before
   import { OpenPkg } from '@openpkg-ts/sdk';
   
   // After
   import { DocCov } from '@doccov/sdk';
   ```

3. Rename config:
   ```bash
   mv openpkg.config.ts doccov.config.ts
   ```

4. Update CLI usage:
   ```bash
   # Before
   openpkg check
   
   # After
   doccov check
   ```

## Roadmap

Upcoming features:

- [ ] Deploy doccov.com landing page
- [ ] Mintlify adapter
- [ ] Fumadocs adapter
- [ ] Package pre-install for `--run-examples`
- [ ] Comment assertion matching (doctest-style)
- [ ] Interactive playground
- [ ] VS Code extension

See [Master Plan](https://github.com/doccov/doccov/blob/main/.cursor/plans/doccov-feature-3764ce3a.plan.md) for full roadmap.

## See Also

- [Installation](../getting-started/installation.md) - Get started
- [Quick Start](../getting-started/quick-start.md) - First steps

