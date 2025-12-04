# DocCov Documentation

Documentation coverage and drift detection for TypeScript.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| `@doccov/cli` | Command-line interface | [![npm](https://img.shields.io/npm/v/@doccov/cli)](https://npmjs.com/package/@doccov/cli) |
| `@doccov/sdk` | Programmatic API | [![npm](https://img.shields.io/npm/v/@doccov/sdk)](https://npmjs.com/package/@doccov/sdk) |
| `@openpkg-ts/spec` | Schema, types, validation | [![npm](https://img.shields.io/npm/v/@openpkg-ts/spec)](https://npmjs.com/package/@openpkg-ts/spec) |

## Naming Convention

DocCov uses two naming conventions:

| Name | Usage | Examples |
|------|-------|----------|
| **DocCov** | Product name, CLI tool, most packages | `@doccov/cli`, `@doccov/sdk`, `doccov.config.js` |
| **OpenPkg** | Specification format (open standard) | `@openpkg-ts/spec`, `openpkg.json` output files |

- **DocCov** is the tool that analyzes your TypeScript documentation
- **OpenPkg** is the open specification format that DocCov outputs (designed to be tool-agnostic)

## Getting Started

- [Installation](./getting-started/installation.md) - Install DocCov packages
- [Quick Start](./getting-started/quick-start.md) - 5-minute tutorial
- [Concepts](./getting-started/concepts.md) - Coverage, drift, signals

## CLI Reference

- [Overview](./cli/overview.md) - Command list and global options
- [Commands](./cli/commands/) - Detailed command reference
  - [generate](./cli/commands/generate.md) - Generate OpenPkg spec
  - [check](./cli/commands/check.md) - Validate coverage thresholds, auto-fix drift
  - [diff](./cli/commands/diff.md) - Compare two specs
  - [report](./cli/commands/report.md) - Generate coverage reports
  - [scan](./cli/commands/scan.md) - Analyze remote GitHub repos
  - [init](./cli/commands/init.md) - Create config file
- [Configuration](./cli/configuration.md) - `doccov.config.ts` options

## API Reference

- [Overview](./api/overview.md) - Hono API, Vercel deployment
- [Endpoints](./api/endpoints/)
  - [Badge](./api/endpoints/badge.md) - Coverage badge SVG
  - [Widget](./api/endpoints/widget.md) - Signal breakdown widget
  - [Leaderboard](./api/endpoints/leaderboard.md) - Public rankings
  - [Scan Stream](./api/endpoints/scan-stream.md) - SSE scanning
  - [Spec](./api/endpoints/spec.md) - Fetch specs from GitHub
  - [Examples Run](./api/endpoints/examples-run.md) - Execute code
- [Self-Hosting](./api/self-hosting.md) - Deploy your own instance

## SDK Reference

- [Overview](./sdk/overview.md) - Package exports
- [DocCov Class](./sdk/doccov-class.md) - Main analysis API
- [Example Runner](./sdk/example-runner.md) - Execute @example blocks
- [Filtering](./sdk/filtering.md) - Include/exclude exports

## Spec Reference

- [Overview](./spec/overview.md) - OpenPkg 0.2.0 schema
- [Types](./spec/types.md) - Full type reference
- [Drift Types](./spec/drift-types.md) - All 10 drift detectors
- [Diffing](./spec/diffing.md) - Compare specs

## Integrations

- [GitHub Action](./integrations/github-action.md) - CI/CD integration
- [Docusaurus](./integrations/docusaurus.md) - Plugin setup
- [CI/CD](./integrations/ci-cd.md) - Generic CI patterns
- [Badges & Widgets](./integrations/badges-widgets.md) - README embeds

## UI Components

- [Overview](./ui/overview.md) - `@doccov/ui` package exports
- [DocsKit](./ui/docskit/)
  - [Code Blocks](./ui/docskit/code-blocks.md) - Syntax-highlighted code
  - [Terminal](./ui/docskit/terminal.md) - macOS-style terminal
  - [Package Install](./ui/docskit/package-install.md) - Package manager tabs
  - [Code Tabs](./ui/docskit/code-tabs.md) - Multi-file code blocks
  - [Inline Code](./ui/docskit/inline-code.md) - Inline highlighting
  - [Annotations](./ui/docskit/annotations.md) - Mark, diff, collapse, hover, tooltip
  - [Client Components](./ui/docskit/client-components.md) - Client-side variants
  - [Skeletons](./ui/docskit/skeletons.md) - Loading states

## Development

- [Local Testing](./development/local-testing.md) - Test CLI/SDK/API locally
- [Vercel Deployment](./development/vercel-deployment.md) - Production deploy
- [Contributing](./development/contributing.md) - Contribution guidelines

## Reference

- [OpenPkg Schema](./reference/openpkg-schema.md) - JSON Schema spec
- [Changelog](./reference/changelog.md) - Release history

