# OpenPkg Fixtures

Quick commands for trying the CLI against the sample fixtures. Each command assumes you are in the repo root and the CLI has been built (`bun run build:cli`).

## Simple Math
```bash
openpkg generate tests/fixtures/simple-math.ts --output tmp/simple-math.json
```

## Blog API (relative imports)
```bash
openpkg generate tests/fixtures/blog-api/main.ts --output tmp/blog-api.json
```

## Circular Dependencies
```bash
openpkg generate tests/fixtures/circular-deps/a.ts --output tmp/circular.json
```

## Deep Imports
```bash
openpkg generate tests/fixtures/deep-imports/index.ts --output tmp/deep-imports.json
```

## Barrel Exports
```bash
openpkg generate tests/fixtures/barrel-exports/index.ts --output tmp/barrel.json
```

## Mixed Import Styles
```bash
openpkg generate tests/fixtures/mixed-imports/calculator.ts --output tmp/mixed.json
```

## Docs Coverage Playground
Use this fixture to test `openpkg check` behavior. It mixes fully documented exports with items missing descriptions, parameter docs, and examples.

```bash
# Ensure CLI is built first
bun run build:cli

# View docs coverage details (will fail because of gaps)
node packages/cli/dist/cli.js check \
  --cwd tests/fixtures/docs-coverage \
  --min-coverage 90 \
  --require-examples
```

## Docs Drift Playground
`tests/fixtures/docs-drift` intentionally keeps outdated `@param` tags to exercise the new drift detector.

```bash
bun run build:cli
node packages/cli/dist/cli.js check \
  --cwd tests/fixtures/docs-drift \
  --min-coverage 50
```

Expected outcome: command fails with a drift report that highlights the mismatched parameter (`tax`) and suggests the new name (`taxRate`).

For more advanced behavior (follow imports, depth limits, etc.), see the CLI documentation in `packages/cli/README.md`.
