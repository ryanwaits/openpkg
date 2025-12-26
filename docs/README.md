# DocCov Documentation

Documentation coverage and drift detection for TypeScript.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@doccov/cli` | Command-line interface | [![npm](https://img.shields.io/npm/v/@doccov/cli)](https://npmjs.com/package/@doccov/cli) |
| `@doccov/sdk` | Programmatic API | [![npm](https://img.shields.io/npm/v/@doccov/sdk)](https://npmjs.com/package/@doccov/sdk) |
| `@doccov/spec` | DocCov schema, drift types | [![npm](https://img.shields.io/npm/v/@doccov/spec)](https://npmjs.com/package/@doccov/spec) |
| `@openpkg-ts/spec` | OpenPkg schema, types, validation | [![npm](https://img.shields.io/npm/v/@openpkg-ts/spec)](https://npmjs.com/package/@openpkg-ts/spec) |
| `@openpkg-ts/extract` | TypeScript extraction CLI (`tspec`) | [![npm](https://img.shields.io/npm/v/@openpkg-ts/extract)](https://npmjs.com/package/@openpkg-ts/extract) |

## Naming Convention

| Name | Usage | Examples |
|------|-------|----------|
| **DocCov** | Product name, coverage analysis | `@doccov/cli`, `doccov.json` |
| **OpenPkg** | TypeScript API spec format | `openpkg.json`, `@openpkg-ts/spec` |
| **tspec** | Standalone TS extraction CLI | `tspec src/index.ts -o openpkg.json` |

## CLI Reference

- [Overview](./cli/overview.md) - Installation & commands
- [Configuration](./cli/configuration.md) - `doccov.yml` options
- [Schema Extraction](./cli/schema-extraction.md) - Static vs runtime modes
- Commands:
  - [check](./cli/commands/check.md) - Coverage analysis & auto-fix
  - [spec](./cli/commands/spec.md) - Generate OpenPkg spec
  - [diff](./cli/commands/diff.md) - Compare specs
  - [info](./cli/commands/info.md) - Quick summary
  - [init](./cli/commands/init.md) - Create config
  - [trends](./cli/commands/trends.md) - Track history
- [tspec CLI](./cli/tspec.md) - Standalone TypeScript extraction

## Architecture

- [OpenPkg & DocCov Separation](./architecture/openpkg-doccov-separation.md) - Two-spec architecture

## SDK Reference

- [Overview](./sdk/overview.md) - Package exports
- [Analysis](./sdk/analysis.md) - DocCov class & pipeline
- [Filtering](./sdk/filtering.md) - Export filtering
- [Quality Rules](./sdk/quality-rules.md) - Rule engine
- [Drift Detection](./sdk/drift-detection.md) - Drift types
- [Example Validation](./sdk/example-validation.md) - @example testing

## API Reference

- [Overview](./api/overview.md) - REST API & rate limits
- [Authentication](./api/authentication.md) - Auth methods
- Endpoints:
  - [Badge](./api/endpoints/badge.md) - Coverage badge SVG
  - [Demo](./api/endpoints/demo.md) - npm package analysis
  - [Organizations](./api/endpoints/orgs.md) - Org management
  - [Coverage](./api/endpoints/coverage.md) - History & snapshots
  - [Billing](./api/endpoints/billing.md) - Subscriptions
  - [AI](./api/endpoints/ai.md) - JSDoc generation
  - [GitHub App](./api/endpoints/github-app.md) - CI integration

## Quick Start

```bash
# Install
npm install -g @doccov/cli

# Check coverage
doccov check

# Generate spec
doccov spec

# Auto-fix drift
doccov check --fix
```

## Config Example

```yaml
# doccov.yml
check:
  minCoverage: 80
  maxDrift: 10

quality:
  rules:
    has-description: error
    has-examples: warn
```

## FAQ

Common questions about entry points, source vs declaration files, schema extraction, and troubleshooting. See [FAQ](./faq.md).
