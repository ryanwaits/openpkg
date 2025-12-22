# DocCov

[![npm](https://img.shields.io/npm/v/@doccov/cli)](https://npmjs.com/package/@doccov/cli)
[![npm](https://img.shields.io/npm/v/@doccov/sdk)](https://npmjs.com/package/@doccov/sdk)

Documentation coverage and drift detection for TypeScript.

## Install

```bash
npm install -g @doccov/cli
```

## Usage

```bash
# Check coverage (fail if below 80%)
doccov check --min-coverage 80

# Generate spec
doccov generate -o openpkg.json
```

## Badges

Add a documentation coverage badge:

```markdown
![DocCov](https://api.doccov.com/badge/YOUR_ORG/YOUR_REPO)
```

Requires `openpkg.json` committed to your default branch. See [badges docs](./docs/integrations/badges.md) for options.

## Documentation

Full documentation at [docs/README.md](./docs/README.md):

- [Getting Started](./docs/getting-started/installation.md)
- [CLI Reference](./docs/cli/overview.md)
- [API Reference](./docs/api/overview.md)
- [SDK Reference](./docs/sdk/overview.md)

## Packages

| Package | Description |
|---------|-------------|
| [@doccov/cli](./packages/cli) | Command-line interface |
| [@doccov/sdk](./packages/sdk) | Programmatic API |
| [@openpkg-ts/spec](./packages/spec) | Schema & validation |

## License

MIT
